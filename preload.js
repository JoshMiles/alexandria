const { contextBridge, ipcRenderer } = require('electron');

// Forward main process logs to the DevTools console
ipcRenderer.on('log-update', (event, entry) => {
  const { level, message, meta } = entry;
  const msg = `[MAIN][${level}] ${message}` + (meta ? ` ${JSON.stringify(meta)}` : '');
  if (level === 'ERROR') {
    window.console.error(msg);
  } else if (level === 'WARN') {
    window.console.warn(msg);
  } else if (level === 'INFO') {
    window.console.info(msg);
  } else {
    window.console.log(msg);
  }
});

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
  openLogsFolder: () => ipcRenderer.invoke('open-logs-folder'),
  on: (channel, callback) => {
    const validChannels = ['update-message', 'search-status', 'search-result'];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => callback(...args));
    }
  },
  onDownloadsUpdated: (callback) => ipcRenderer.on('downloads-updated', (event, ...args) => callback(...args)),
  onDownloadProgress: (callback) => ipcRenderer.on('download-progress', (event, ...args) => callback(...args)),
  getDownloadLocation: () => ipcRenderer.invoke('get-download-location'),
  getVersion: () => ipcRenderer.invoke('get-version'),
  getLatestLog: () => ipcRenderer.invoke('get-latest-log'),
  onLogUpdate: (callback) => ipcRenderer.on('log-update', (event, logEntry) => callback(logEntry)),
  offLogUpdate: (callback) => ipcRenderer.removeListener('log-update', (event, logEntry) => callback(logEntry)),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  clearAppData: () => ipcRenderer.invoke('clear-app-data'),
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  log: (level, message, meta) => ipcRenderer.invoke('log', { level, message, meta })
});

console.log('[Preload] Exposing electron API:', Object.keys(contextBridge.exposeInMainWorld ? { ...window.electron } : {}));

