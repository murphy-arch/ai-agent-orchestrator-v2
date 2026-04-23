const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // App control
  restartApp: () => ipcRenderer.invoke('app:restart'),
  getVersion: () => ipcRenderer.invoke('app:get-version'),

  // Platform info
  platform: process.platform,

  // Notifications
  showNotification: (options) => ipcRenderer.invoke('notification:show', options),

  // Settings
  getSetting: (key) => ipcRenderer.invoke('settings:get', key),
  setSetting: (key, value) => ipcRenderer.invoke('settings:set', key, value),

  // Listen for events from main
  onUpdateAvailable: (callback) => {
    ipcRenderer.on('update-available', (_, info) => callback(info));
  },
  onUpdateDownloaded: (callback) => {
    ipcRenderer.on('update-downloaded', () => callback());
  },
});
