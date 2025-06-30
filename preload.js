const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  platform: process.platform,
  minimize: () => ipcRenderer.send('minimize'),
  maximize: () => ipcRenderer.send('maximize'),
  close: () => ipcRenderer.send('close'),
  search: (query) => ipcRenderer.invoke('search', query),
  download: (options) => ipcRenderer.invoke('download', options),
  getDownloadLinks: (link) => ipcRenderer.invoke('get-download-links', link),
  resolve: (link) => ipcRenderer.invoke('resolve', link),
  openLink: (link) => ipcRenderer.invoke('open-link', link),
  getDownloads: () => ipcRenderer.invoke('get-downloads'),
  clearDownloads: () => ipcRenderer.invoke('clear-downloads'),
  cancelDownload: (clientId) => ipcRenderer.invoke('cancel-download', clientId),
  openFile: (filename) => ipcRenderer.invoke('open-file', filename),
  openFolder: (filename) => ipcRenderer.invoke('open-folder', filename),
  on: (channel, callback) => {
    const validChannels = ['update-message', 'search-status'];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => callback(...args));
    }
  },
  onDownloadsUpdated: (callback) => ipcRenderer.on('downloads-updated', (event, ...args) => callback(...args)),
  onDownloadProgress: (callback) => ipcRenderer.on('download-progress', (event, ...args) => callback(...args)),
  getDownloadLocation: () => ipcRenderer.invoke('get-download-location'),
  getVersion: () => ipcRenderer.invoke('get-version'),
  getLibgenAccessInfo: () => ipcRenderer.invoke('get-libgen-access-info'),
  resetLibgenAccessMethod: () => ipcRenderer.invoke('reset-libgen-access-method'),
  addLibgenMirror: (url) => ipcRenderer.invoke('add-libgen-mirror', url),
  removeLibgenMirror: (url) => ipcRenderer.invoke('remove-libgen-mirror', url),
  testLibgenAccess: () => ipcRenderer.invoke('test-libgen-access'),
});

