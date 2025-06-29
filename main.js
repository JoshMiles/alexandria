const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const log = require('electron-log');
const fs = require('fs');
const { pipeline } = require('stream');
const Store = require('electron-store');
let got;
const { autoUpdater } = require('electron-updater');
const { search, getDownloadLinks, resolveDirectDownloadLink } = require('./dist/backend.js');

let store;
let downloadItems = {};
let mainWindow;

log.transports.file.level = 'info';
log.info('App starting...');

autoUpdater.logger = log;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'dist/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const version = app.getVersion();
  mainWindow.setTitle(`Alexandria - ${version}`);
  mainWindow.loadFile('dist/index.html');
  
  mainWindow.once('ready-to-show', () => {
    autoUpdater.checkForUpdatesAndNotify();
  });
}

app.whenReady().then(async () => {
  got = (await import('got')).default;
  store = new Store();
  
  const downloads = store.get('downloads', []);
  const completedDownloads = downloads.filter(d => d.state === 'completed');
  store.set('downloads', completedDownloads);

  Store.initRenderer();

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  app.quit();
});

ipcMain.handle('search', async (event, query) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const results = await search(win, query, log);
  return results;
});

ipcMain.handle('download', async (event, { book }) => {
  const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
  const downloadsPath = app.getPath('downloads');
  const rawFileName = `${book.title} - ${book.author} (${book.year}) (${book.language}).${book.extension}`;
  const sanitizedFileName = rawFileName.replace(/[^\w\s.-]/g, '').trim();
  const filePath = path.join(downloadsPath, sanitizedFileName);

  const downloadItem = {
    ...book,
    filename: sanitizedFileName,
    path: filePath,
    state: 'resolving',
    percent: 0,
    transferredBytes: 0,
    totalBytes: 0,
    startTime: Date.now(),
  };

  let downloads = store.get('downloads', []);
  downloads.push(downloadItem);
  store.set('downloads', downloads);
  win.webContents.send('downloads-updated', downloads);

  try {
    const downloadPageUrl = book.mirror_links[0].startsWith('http')
      ? book.mirror_links[0]
      : `https://libgen.li/${book.mirror_links[0]}`;
    
    const downloadLinks = await getDownloadLinks(downloadPageUrl, log);
    if (!downloadLinks || downloadLinks.length === 0) {
      throw new Error('No download links found');
    }

    const directLink = await resolveDirectDownloadLink(downloadLinks[0], log);
    if (!directLink) {
      throw new Error('Could not resolve direct download link');
    }

    const downloadStream = got.stream(directLink);
    const fileWriterStream = fs.createWriteStream(filePath);
    downloadItems[book.client_id] = downloadStream;

    downloadStream.on('downloadProgress', (progress) => {
      const currentDownloads = store.get('downloads', []);
      const item = currentDownloads.find((d) => d.client_id === book.client_id);
      if (item) {
        item.state = 'downloading';
        item.percent = progress.percent;
        item.transferredBytes = progress.transferred;
        item.totalBytes = progress.total;
        win.webContents.send('download-progress', {
          clientId: book.client_id,
          progress: {
            percent: progress.percent,
            transferred: progress.transferred,
            total: progress.total,
          },
        });
      }
    });

    pipeline(downloadStream, fileWriterStream, (error) => {
      const finalDownloads = store.get('downloads', []);
      const item = finalDownloads.find((d) => d.client_id === book.client_id);
      if (item) {
        if (error) {
          item.state = 'failed';
          log.error(`Download failed: ${error.message}`);
        } else {
          item.state = 'completed';
        }
        store.set('downloads', finalDownloads);
        win.webContents.send('downloads-updated', finalDownloads);
      }
      delete downloadItems[book.client_id];
    });
  } catch (error) {
    log.error('Error in download process:', error);
    const finalDownloads = store.get('downloads', []);
    const item = finalDownloads.find((d) => d.client_id === book.client_id);
    if (item) {
      item.state = 'failed';
      store.set('downloads', finalDownloads);
      win.webContents.send('downloads-updated', finalDownloads);
    }
  }
});

ipcMain.handle('get-downloads', () => {
  return store.get('downloads', []);
});

ipcMain.handle('clear-downloads', () => {
  const downloads = store.get('downloads', []);
  const inProgressDownloads = downloads.filter(d => d.state === 'downloading' || d.state === 'resolving');
  store.set('downloads', inProgressDownloads);
  return inProgressDownloads;
});

ipcMain.handle('cancel-download', (event, clientId) => {
  const downloadStream = downloadItems[clientId];
  if (downloadStream) {
    downloadStream.destroy();
  }
  const downloads = store.get('downloads', []);
  const newDownloads = downloads.filter((d) => d.client_id !== clientId);
  store.set('downloads', newDownloads);
  return newDownloads;
});

ipcMain.handle('open-file', (event, filename) => {
  const downloads = store.get('downloads', []);
  const downloadItem = downloads.find((d) => d.filename === filename);
  if (downloadItem && downloadItem.state === 'completed') {
    shell.openPath(downloadItem.path);
  }
});

ipcMain.handle('open-folder', (event, filename) => {
  const downloads = store.get('downloads', []);
  const downloadItem = downloads.find((d) => d.filename === filename);
  if (downloadItem && downloadItem.state === 'completed') {
    shell.showItemInFolder(downloadItem.path);
  }
});

ipcMain.handle('open-link', (event, link) => {
  shell.openExternal(link);
});

ipcMain.handle('get-download-location', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  });
  if (canceled) {
    return null;
  } else {
    return filePaths[0];
  }
});

ipcMain.handle('get-version', () => {
  return app.getVersion();
});