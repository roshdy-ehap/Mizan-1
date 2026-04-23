/**
 * preload.js — الجسر الآمن بين index.html و Node.js
 * كل الـ API اللي بيستخدمها index.html موجودة هنا
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  portable:   true,
  platform:   process.platform,

  // ── حفظ / تحميل البيانات ──
  saveData:   (json)         => ipcRenderer.invoke('save-data', json),
  loadData:   ()             => ipcRenderer.invoke('load-data'),

  // ── ملفات ──
  writeFile:  (path, data)   => ipcRenderer.invoke('write-file', path, data),
  readFile:   (path)         => ipcRenderer.invoke('read-file', path),
  listBackups:(dir)          => ipcRenderer.invoke('list-folder', dir),

  // ── حوارات ──
  selectFolder: (title)      => ipcRenderer.invoke('select-folder', title),
  saveDialog:   (name, data) => ipcRenderer.invoke('save-dialog', name, data),
  openDialog:   ()           => ipcRenderer.invoke('open-dialog'),

  // ── مسارات ──
  getDefaultBackupDir: ()    => ipcRenderer.invoke('get-default-backup-dir'),

  // ── معلومات ──
  appInfo:    ()             => ipcRenderer.invoke('app-info'),
});
