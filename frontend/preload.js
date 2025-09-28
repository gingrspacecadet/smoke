const { contextBridge, ipcRenderer } = require('electron');
// const path = require('path');

contextBridge.exposeInMainWorld('electronAPI', {
  downloadGame: (url, filename) => ipcRenderer.send('download-game', { url, filename }),
  onDownloadProgress: (callback) => ipcRenderer.on('download-progress', callback),
  onDownloadComplete: (callback) => ipcRenderer.on('download-complete', callback),
  onInstallProgress: (callback) => ipcRenderer.on('install-progress', callback),
  onInstallComplete: (callback) => ipcRenderer.on('install-complete', callback),
  onInstallError: (callback) => ipcRenderer.on('install-error', callback),
  listInstalledGames: () => ipcRenderer.invoke('list-installed-games'),
  runGame: (exePath) => ipcRenderer.invoke('run-game', exePath),
  notify: (opts) => ipcRenderer.invoke('notify', opts),
  onInAppNotification: (callback) => {
    // callback receives the notification options
    const listener = (evt, opts) => callback(opts);
    ipcRenderer.on('show-in-app-notification', listener);

    // return a function to remove the listener if caller wants to
    return () => ipcRenderer.removeListener('show-in-app-notification', listener);
  },
  onNotificationClicked: (callback) => {
    const l = (evt, opts) => callback(opts);
    ipcRenderer.on('notification-clicked', l);
    return () => ipcRenderer.removeListener('notification-clicked', l);
  },
  openAppFolder: (name) => ipcRenderer.invoke('open-app-folder', name),
});
