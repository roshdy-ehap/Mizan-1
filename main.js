const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs   = require('fs');
const os   = require('os');

const DATA_DIR   = path.join(app.getPath('userData'), 'data');
const BACKUP_DIR = path.join(app.getPath('userData'), 'backups');
const DB_FILE    = path.join(DATA_DIR, 'db.json');

[DATA_DIR, BACKUP_DIR].forEach(d => {
  try { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); } catch(e) {}
});

function getIconPath() {
  const ico = path.join(__dirname, 'src', 'icon.ico');
  return fs.existsSync(ico) ? ico : undefined;
}

let mainWindow;

function createWindow() {
  const opts = {
    width: 1280, height: 820, minWidth: 900, minHeight: 580,
    title: 'Mizan POS',
    backgroundColor: '#070d1a',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false,
      allowRunningInsecureContent: true,
    }
  };
  const ico = getIconPath();
  if (ico) opts.icon = ico;

  mainWindow = new BrowserWindow(opts);
  mainWindow.setMenuBarVisibility(false);

  // ── التحميل مع retry ──
  const htmlPath = path.join(__dirname, 'src', 'index.html');

  if (fs.existsSync(htmlPath)) {
    mainWindow.loadFile(htmlPath);
  } else {
    // fallback: جرب بـ URL
    mainWindow.loadURL('file://' + htmlPath.replace(/\\/g, '/'));
  }

  // اظهار النافذة بعد التحميل
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // لو فشل التحميل — اظهر النافذة على طول مع رسالة
  mainWindow.webContents.on('did-fail-load', (_e, code, desc, url) => {
    console.error('Load failed:', code, desc, url);
    mainWindow.show();
    mainWindow.loadURL(
      'data:text/html;charset=utf-8,' +
      encodeURIComponent(
        '<html dir="rtl"><body style="background:#070d1a;color:#f05252;font-family:sans-serif;text-align:center;padding:60px">' +
        '<h2>خطأ في تحميل التطبيق</h2>' +
        '<p style="color:#6a84aa">كود الخطأ: ' + code + '</p>' +
        '<p style="color:#6a84aa;font-size:12px">' + htmlPath + '</p>' +
        '</body></html>'
      )
    );
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => app.quit());

// ── IPC Handlers ─────────────────────────────────────────

ipcMain.handle('save-data', async (_e, json) => {
  try { fs.writeFileSync(DB_FILE, json, 'utf-8'); return { ok: true }; }
  catch(e) { return { ok: false, error: e.message }; }
});

ipcMain.handle('load-data', async () => {
  try {
    if (fs.existsSync(DB_FILE))
      return { ok: true, data: fs.readFileSync(DB_FILE, 'utf-8') };
    return { ok: true, data: null };
  } catch(e) { return { ok: false, error: e.message }; }
});

ipcMain.handle('write-file', async (_e, filePath, data) => {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, data, 'utf-8');
    return { ok: true };
  } catch(e) { return { ok: false, error: e.message }; }
});

ipcMain.handle('read-file', async (_e, filePath) => {
  try {
    if (fs.existsSync(filePath))
      return { ok: true, data: fs.readFileSync(filePath, 'utf-8') };
    return { ok: false, error: 'not found' };
  } catch(e) { return { ok: false, error: e.message }; }
});

ipcMain.handle('list-folder', async (_e, folderPath) => {
  try {
    if (!fs.existsSync(folderPath)) return { ok: true, files: [] };
    const files = fs.readdirSync(folderPath)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        const fp = path.join(folderPath, f);
        const st = fs.statSync(fp);
        return { name: f, path: fp, size: st.size, mtime: st.mtimeMs };
      })
      .sort((a, b) => b.mtime - a.mtime);
    return { ok: true, files };
  } catch(e) { return { ok: false, error: e.message }; }
});

ipcMain.handle('select-folder', async (_e, title) => {
  if (!mainWindow) return { ok: false };
  const r = await dialog.showOpenDialog(mainWindow, {
    title: title || 'اختر مجلداً',
    properties: ['openDirectory'],
    defaultPath: os.homedir(),
  });
  if (r.canceled || !r.filePaths.length) return { ok: false };
  return { ok: true, path: r.filePaths[0] };
});

ipcMain.handle('save-dialog', async (_e, defaultName, data) => {
  if (!mainWindow) return { ok: false };
  const r = await dialog.showSaveDialog(mainWindow, {
    title: 'حفظ نسخة احتياطية',
    defaultPath: path.join(os.homedir(), 'Desktop', defaultName || 'backup.json'),
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (r.canceled || !r.filePath) return { ok: false };
  try { fs.writeFileSync(r.filePath, data, 'utf-8'); return { ok: true, path: r.filePath }; }
  catch(e) { return { ok: false, error: e.message }; }
});

ipcMain.handle('open-dialog', async () => {
  if (!mainWindow) return { ok: false };
  const r = await dialog.showOpenDialog(mainWindow, {
    title: 'استعادة نسخة احتياطية',
    defaultPath: os.homedir(),
    filters: [{ name: 'JSON', extensions: ['json'] }, { name: 'All Files', extensions: ['*'] }],
    properties: ['openFile'],
  });
  if (r.canceled || !r.filePaths.length) return { ok: false };
  try { return { ok: true, data: fs.readFileSync(r.filePaths[0], 'utf-8'), path: r.filePaths[0] }; }
  catch(e) { return { ok: false, error: e.message }; }
});

ipcMain.handle('get-default-backup-dir', () => BACKUP_DIR);

ipcMain.handle('app-info', () => ({
  platform:   process.platform,
  version:    app.getVersion(),
  dataDir:    DATA_DIR,
  backupDir:  BACKUP_DIR,
  isElectron: true,
  portable:   true,
}));// قراءة ملف
ipcMain.handle('read-file', async (_event, filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      return { ok: true, data: fs.readFileSync(filePath, 'utf-8') };
    }
    return { ok: false, error: 'not found' };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// قائمة ملفات مجلد (للنسخ الاحتياطية)
ipcMain.handle('list-folder', async (_event, folderPath) => {
  try {
    if (!fs.existsSync(folderPath)) return { ok: true, files: [] };
    const files = fs.readdirSync(folderPath)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        const fp = path.join(folderPath, f);
        const st = fs.statSync(fp);
        return { name: f, path: fp, size: st.size, mtime: st.mtimeMs };
      })
      .sort((a, b) => b.mtime - a.mtime);
    return { ok: true, files };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// اختيار مجلد
ipcMain.handle('select-folder', async (_event, title) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: title || 'اختر مجلداً',
    properties: ['openDirectory'],
    defaultPath: os.homedir(),
  });
  if (result.canceled || !result.filePaths.length) return { ok: false };
  return { ok: true, path: result.filePaths[0] };
});

// حوار حفظ ملف
ipcMain.handle('save-dialog', async (_event, defaultName, data) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'حفظ نسخة احتياطية',
    defaultPath: path.join(os.homedir(), 'Desktop', defaultName || 'backup.json'),
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (result.canceled || !result.filePath) return { ok: false };
  try {
    fs.writeFileSync(result.filePath, data, 'utf-8');
    return { ok: true, path: result.filePath };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// حوار فتح ملف
ipcMain.handle('open-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'استعادة نسخة احتياطية',
    defaultPath: os.homedir(),
    filters: [{ name: 'JSON', extensions: ['json'] }, { name: 'All Files', extensions: ['*'] }],
    properties: ['openFile'],
  });
  if (result.canceled || !result.filePaths.length) return { ok: false };
  try {
    const data = fs.readFileSync(result.filePaths[0], 'utf-8');
    return { ok: true, data, path: result.filePaths[0] };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// مجلد النسخ الافتراضي
ipcMain.handle('get-default-backup-dir', () => {
  return BACKUP_DIR;
});

// معلومات التطبيق
ipcMain.handle('app-info', () => {
  return {
    platform: process.platform,
    version:  app.getVersion(),
    dataDir:  DATA_DIR,
    isElectron: true,
    portable: true,
  };
});
