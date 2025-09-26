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
  runGame: (exePath) => ipcRenderer.invoke('run-game', exePath)
});
