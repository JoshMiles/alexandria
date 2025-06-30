const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const log = require('electron-log');
const fs = require('fs');
const { pipeline } = require('stream');
const os = require('os');
const https = require('https');
let Store;
let got;
const { autoUpdater } = require('electron-updater');
const { search, getDownloadLinks, resolveDirectDownloadLink, getSciHubDownloadLink, getLibgenAccessInfo, resetLibgenAccessMethod, addLibgenMirror, removeLibgenMirror, testLibgenAccess } = require('./dist/backend.js');

let store;
let downloadItems = {};
let mainWindow;
let startupWindow;

log.transports.file.level = 'info';
log.info('App starting...');

autoUpdater.logger = log;

function createStartupWindow() {
  log.info('Creating startup window.');
  startupWindow = new BrowserWindow({
    width: 400,
    height: 200,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'dist/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  startupWindow.loadFile('dist/startup.html');
  startupWindow.on('closed', () => {
    log.info('Startup window closed.');
    startupWindow = null;
  });
}

function createWindow() {
  log.info('Creating main window.');
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    frame: false,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 15, y: 15 },
    webPreferences: {
      preload: path.join(__dirname, 'dist/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const version = app.getVersion();
  mainWindow.setTitle(`Alexandria - ${version}`);
  mainWindow.loadFile('dist/index.html');
  
  // Maximize the window by default
  mainWindow.maximize();
  
  mainWindow.on('closed', () => {
    log.info('Main window closed.');
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  log.info('App is ready.');
  got = (await import('got')).default;
  Store = (await import('electron-store')).default;
  store = new Store();
  
  const downloads = store.get('downloads', []);
  const completedDownloads = downloads.filter(d => d.state === 'completed');
  store.set('downloads', completedDownloads);

  Store.initRenderer();

  createStartupWindow();

  autoUpdater.on('checking-for-update', () => {
    startupWindow.webContents.send('update-message', 'Checking for updates...');
  });

  autoUpdater.on('update-available', (info) => {
    startupWindow.webContents.send('update-message', `Update available: ${info.version}`);
  });

  autoUpdater.on('update-not-available', async () => {
    startupWindow.webContents.send('update-message', 'No updates available.');
    // Start LibGen access check after update check
    setTimeout(async () => {
      if (startupWindow) {
        log.info('Performing LibGen access check...');
        try {
          const result = await testLibgenAccess(startupWindow, log);
          if (result.success) {
            log.info(`LibGen access check successful. Working mirror: ${result.workingMirror}`);
          } else {
            log.warn(`LibGen access check failed: ${result.error}`);
          }
        } catch (error) {
          log.error('Error during LibGen access check:', error);
        }
        
        // Close startup window and create main window
        setTimeout(() => {
          if (startupWindow) {
            startupWindow.close();
          }
          createWindow();
        }, 1000);
      }
    }, 1000);
  });

  autoUpdater.on('error', async (err) => {
    startupWindow.webContents.send('update-message', `Error in auto-updater: ${err.toString()}`);
    // Start LibGen access check even if update check failed
    setTimeout(async () => {
      if (startupWindow) {
        log.info('Performing LibGen access check...');
        try {
          const result = await testLibgenAccess(startupWindow, log);
          if (result.success) {
            log.info(`LibGen access check successful. Working mirror: ${result.workingMirror}`);
          } else {
            log.warn(`LibGen access check failed: ${result.error}`);
          }
        } catch (error) {
          log.error('Error during LibGen access check:', error);
        }
        
        // Close startup window and create main window
        setTimeout(() => {
          if (startupWindow) {
            startupWindow.close();
          }
          createWindow();
        }, 1000);
      }
    }, 1000);
  });

  autoUpdater.on('download-progress', (progressObj) => {
    startupWindow.webContents.send('update-message', `Downloading update: ${Math.round(progressObj.percent)}%`);
  });

  autoUpdater.on('update-downloaded', (info) => {
    startupWindow.webContents.send('update-message', `Update downloaded: ${info.version}. Restarting...`);
    autoUpdater.quitAndInstall();
  });

  if (app.isPackaged) {
    autoUpdater.checkForUpdates();
  } else {
    // In development, skip update check but still do LibGen check
    setTimeout(async () => {
      if (startupWindow) {
        log.info('Performing LibGen access check...');
        try {
          const result = await testLibgenAccess(startupWindow, log);
          if (result.success) {
            log.info(`LibGen access check successful. Working mirror: ${result.workingMirror}`);
          } else {
            log.warn(`LibGen access check failed: ${result.error}`);
          }
        } catch (error) {
          log.error('Error during LibGen access check:', error);
        }
        
        // Close startup window and create main window
        setTimeout(() => {
          if (startupWindow) {
            startupWindow.close();
          }
          createWindow();
        }, 1000);
      }
    }, 1000);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      log.info('App activated, creating new window.');
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  log.info('All windows closed, quitting application.');
  app.quit();
});

ipcMain.on('minimize', () => {
  if (mainWindow) {
    log.info('Minimizing main window.');
    mainWindow.minimize();
  }
});

ipcMain.on('maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      log.info('Unmaximizing main window.');
      mainWindow.unmaximize();
    } else {
      log.info('Maximizing main window.');
      mainWindow.maximize();
    }
  }
});

ipcMain.on('close', () => {
  if (mainWindow) {
    log.info('Closing main window.');
    mainWindow.close();
  }
});

ipcMain.handle('search', async (event, query) => {
  log.info(`Received search request for query: "${query}"`);
  const win = BrowserWindow.fromWebContents(event.sender);
  const results = await search(win, query, log);
  log.info(`Search for "${query}" returned ${results.length} results.`);
  return results;
});

ipcMain.handle('download', async (event, { book }) => {
  log.info(`Download request for book: "${book.title}" (ID: ${book.client_id})`);
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
    progress: {
      percent: 0,
      transferred: 0,
      total: 0,
    },
    startTime: Date.now(),
  };

  let downloads = store.get('downloads', []);
  downloads.push(downloadItem);
  store.set('downloads', downloads);
  win.webContents.send('downloads-updated', downloads);
  log.info(`Download item added and updated in store for "${book.title}"`);

  // DOI Download Logic
  if (book.doi) {
    try {
      log.info(`Attempting to download DOI: ${book.doi}`);
      const directLink = await getSciHubDownloadLink(book.doi, log);
      if (!directLink) {
        throw new Error('Could not resolve Sci-Hub download link');
      }

      log.info(`Starting download for "${book.title}" from Sci-Hub link: ${directLink}`);
      const downloadStream = got.stream(directLink);
      const fileWriterStream = fs.createWriteStream(filePath);
      downloadItems[book.client_id] = downloadStream;

      const currentDownloads = store.get('downloads', []);
      const item = currentDownloads.find((d) => d.client_id === book.client_id);
      if (item) {
        item.state = 'downloading';
        store.set('downloads', currentDownloads);
        win.webContents.send('downloads-updated', currentDownloads);
      }

      downloadStream.on('downloadProgress', (progress) => {
        const currentDownloads = store.get('downloads', []);
        const item = currentDownloads.find((d) => d.client_id === book.client_id);
        if (item) {
          item.state = 'downloading';
          item.progress = {
            percent: progress.total ? progress.percent : 0,
            transferred: progress.transferred,
            total: progress.total,
          };
          store.set('downloads', currentDownloads);
          win.webContents.send('download-progress', {
            clientId: book.client_id,
            progress: item.progress,
          });
        }
      });

      pipeline(downloadStream, fileWriterStream, (error) => {
        const finalDownloads = store.get('downloads', []);
        const item = finalDownloads.find((d) => d.client_id === book.client_id);
        if (item) {
          if (error) {
            item.state = 'failed';
            log.error(`Download failed for "${book.title}": ${error.message}`);
          } else {
            item.state = 'completed';
            log.info(`Download completed for "${book.title}"`);
          }
          store.set('downloads', finalDownloads);
          win.webContents.send('downloads-updated', finalDownloads);
        }
        delete downloadItems[book.client_id];
      });
      return;
    } catch (error) {
      log.error(`Error downloading DOI ${book.doi}:`, error);
      const finalDownloads = store.get('downloads', []);
      const item = finalDownloads.find((d) => d.client_id === book.client_id);
      if (item) {
        item.state = 'failed';
        store.set('downloads', finalDownloads);
        win.webContents.send('downloads-updated', finalDownloads);
      }
      return;
    }
  }

  // Regular Download Logic
  for (const mirror of book.mirror_links) {
    try {
      const downloadPageUrl = mirror.startsWith('http')
        ? mirror
        : `https://libgen.li/${mirror}`;
      
      log.info(`Attempting to get download links from mirror: ${downloadPageUrl}`);
      const downloadLinks = await getDownloadLinks(downloadPageUrl, log);
      if (!downloadLinks || downloadLinks.length === 0) {
        throw new Error('No download links found');
      }

      log.info(`Resolving direct download link from: ${downloadLinks[0]}`);
      const directLink = await resolveDirectDownloadLink(downloadLinks[0], log);
      if (!directLink) {
        throw new Error('Could not resolve direct download link');
      }

      if (directLink.includes('slow_download')) {
        log.info(`Handling slow download for "${book.title}", opening in browser.`);
        shell.openExternal(directLink);
        const finalDownloads = store.get('downloads', []);
        const item = finalDownloads.find((d) => d.client_id === book.client_id);
        if (item) {
          item.state = 'browser-download';
          store.set('downloads', finalDownloads);
          win.webContents.send('downloads-updated', finalDownloads);
        }
        return;
      }

      log.info(`Starting download for "${book.title}" from direct link.`);
      const downloadStream = got.stream(directLink);
      const fileWriterStream = fs.createWriteStream(filePath);
      downloadItems[book.client_id] = downloadStream;

      const currentDownloads = store.get('downloads', []);
      const item = currentDownloads.find((d) => d.client_id === book.client_id);
      if (item) {
        item.state = 'downloading';
        store.set('downloads', currentDownloads);
        win.webContents.send('downloads-updated', currentDownloads);
      }

      downloadStream.on('downloadProgress', (progress) => {
        const currentDownloads = store.get('downloads', []);
        const item = currentDownloads.find((d) => d.client_id === book.client_id);
        if (item) {
          item.state = 'downloading';
          item.progress = {
            percent: progress.total ? progress.percent : 0,
            transferred: progress.transferred,
            total: progress.total,
          };
          store.set('downloads', currentDownloads);
          win.webContents.send('download-progress', {
            clientId: book.client_id,
            progress: item.progress,
          });
        }
      });

      pipeline(downloadStream, fileWriterStream, (error) => {
        const finalDownloads = store.get('downloads', []);
        const item = finalDownloads.find((d) => d.client_id === book.client_id);
        if (item) {
          if (error) {
            item.state = 'failed';
            log.error(`Download failed for "${book.title}": ${error.message}`);
          } else {
            item.state = 'completed';
            log.info(`Download completed for "${book.title}"`);
          }
          store.set('downloads', finalDownloads);
          win.webContents.send('downloads-updated', finalDownloads);
        }
        delete downloadItems[book.client_id];
      });
      return; // Exit the loop if download starts successfully
    } catch (error) {
      log.error(`Error with mirror ${mirror} for book "${book.title}":`, error);
      // Continue to the next mirror
    }
  }

  // If all mirrors fail
  log.error(`All mirrors failed for book: "${book.title}"`);
  const finalDownloads = store.get('downloads', []);
  const item = finalDownloads.find((d) => d.client_id === book.client_id);
  if (item) {
    item.state = 'failed';
    store.set('downloads', finalDownloads);
    win.webContents.send('downloads-updated', finalDownloads);
  }
});

ipcMain.handle('get-downloads', () => {
  log.info('Fetching current downloads list.');
  return store.get('downloads', []);
});

ipcMain.handle('clear-downloads', () => {
  log.info('Clearing completed downloads from the list.');
  const downloads = store.get('downloads', []);
  const inProgressDownloads = downloads.filter(d => d.state === 'downloading' || d.state === 'resolving');
  store.set('downloads', inProgressDownloads);
  return inProgressDownloads;
});

ipcMain.handle('cancel-download', (event, clientId) => {
  log.info(`Canceling download for client ID: ${clientId}`);
  const downloadStream = downloadItems[clientId];
  if (downloadStream) {
    downloadStream.destroy();
    log.info(`Download stream destroyed for client ID: ${clientId}`);
  }
  const downloads = store.get('downloads', []);
  const newDownloads = downloads.filter((d) => d.client_id !== clientId);
  store.set('downloads', newDownloads);
  return newDownloads;
});

ipcMain.handle('open-file', (event, filename) => {
  log.info(`Request to open file: "${filename}"`);
  const downloads = store.get('downloads', []);
  const downloadItem = downloads.find((d) => d.filename === filename);
  if (downloadItem && downloadItem.state === 'completed') {
    shell.openPath(downloadItem.path);
  } else {
    log.warn(`File not found or not completed: "${filename}"`);
  }
});

ipcMain.handle('open-folder', (event, filename) => {
  log.info(`Request to open folder for file: "${filename}"`);
  const downloads = store.get('downloads', []);
  const downloadItem = downloads.find((d) => d.filename === filename);
  if (downloadItem && downloadItem.state === 'completed') {
    shell.showItemInFolder(downloadItem.path);
  } else {
    log.warn(`File not found or not completed, cannot open folder: "${filename}"`);
  }
});

ipcMain.handle('open-link', (event, link) => {
  log.info(`Opening external link: ${link}`);
  shell.openExternal(link);
});

ipcMain.handle('get-download-location', async () => {
  log.info('Opening dialog to select download location.');
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  });
  if (canceled) {
    log.info('Download location selection was canceled.');
    return null;
  } else {
    log.info(`Download location selected: ${filePaths[0]}`);
    return filePaths[0];
  }
});

ipcMain.handle('get-version', () => {
  const version = app.getVersion();
  log.info(`Fetching app version: ${version}`);
  return version;
});

// IPC handler to get LibGen access info
ipcMain.handle('get-libgen-access-info', async () => {
  return await getLibgenAccessInfo();
});

// IPC handler to reset LibGen access method
ipcMain.handle('reset-libgen-access-method', () => {
  return resetLibgenAccessMethod();
});

ipcMain.handle('add-libgen-mirror', async (event, url) => {
  return await addLibgenMirror(url);
});

ipcMain.handle('remove-libgen-mirror', async (event, url) => {
  return await removeLibgenMirror(url);
});

// IPC handler to test LibGen access
ipcMain.handle('test-libgen-access', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
  return await testLibgenAccess(win, log);
});