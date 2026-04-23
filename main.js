const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs   = require('fs');
const os   = require('os');

// ── مسارات البيانات ──────────────────────────────────────
// البيانات تُحفظ جنب الـ EXE في مجلد "ميزان-بيانات"
function getAppDir() {
  // في وضع portable، نحفظ جنب الـ exe
  if (app.isPackaged) {
    return path.dirname(process.execPath);
  }
  return __dirname;
}

const DATA_DIR    = path.join(getAppDir(), 'ميزان-بيانات');
const BACKUP_DIR  = path.join(getAppDir(), 'ميزان-نسخ احتياطية');
const DB_FILE     = path.join(DATA_DIR, 'db.json');

// إنشاء المجلدات عند أول تشغيل
[DATA_DIR, BACKUP_DIR].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

let mainWindow;

// ── إنشاء النافذة الرئيسية ───────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width:  1280,
    height: 820,
    minWidth:  900,
    minHeight: 580,
    title: 'ميزان POS',
    backgroundColor: '#070d1a',
    show: false, // نخبّيها لحد ما تحمّل كاملاً
    autoHideMenuBar: true, // نخبّي شريط القوائم
    icon: path.join(__dirname, 'src', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  // إظهار النافذة بعد التحميل
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // منع فتح روابط خارجية في نفس النافذة
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ════════════════════════════════════════════════════════
//  IPC Handlers — الجسر بين HTML و Node.js
// ════════════════════════════════════════════════════════

// حفظ البيانات
ipcMain.handle('save-data', async (_event, dataJson) => {
  try {
    fs.writeFileSync(DB_FILE, dataJson, 'utf-8');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// تحميل البيانات
ipcMain.handle('load-data', async () => {
  try {
    if (fs.existsSync(DB_FILE)) {
      return { ok: true, data: fs.readFileSync(DB_FILE, 'utf-8') };
    }
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// كتابة ملف (للنسخ الاحتياطية)
ipcMain.handle('write-file', async (_event, filePath, data) => {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, data, 'utf-8');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// قراءة ملف
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
