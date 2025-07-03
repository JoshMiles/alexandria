const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const logger = require('./backend/logger.js');
const fs = require('fs');
const { pipeline } = require('stream');
const os = require('os');
const https = require('https');
const { search, getDownloadLinks, resolveDirectDownloadLink, getSciHubDownloadLink, getLibgenAccessInfo, resetLibgenAccessMethod, addLibgenMirror, removeLibgenMirror, testLibgenAccess } = require('./dist/backend.js');
const { autoUpdater } = require('electron-updater');

let store;
let downloadItems = {};
let mainWindow;
let startupWindow;

logger.info('App starting...');

function createStartupWindow() {
  logger.info('Creating startup window.');
  startupWindow = new BrowserWindow({
    width: 400,
    height: 200,
    frame: false,
    icon: path.join(__dirname, 'assets', process.platform === 'darwin' ? 'icon.icns' : process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'dist/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  startupWindow.loadFile('dist/startup.html');
  startupWindow.on('closed', () => {
    logger.info('Startup window closed.');
    startupWindow = null;
  });
}

function createWindow() {
  logger.info('Creating main window.');
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    frame: false,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 15, y: 15 },
    icon: path.join(__dirname, 'assets', process.platform === 'darwin' ? 'icon.icns' : process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'dist/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    backgroundColor: '#121212',
  });

  const version = app.getVersion();
  mainWindow.setTitle(`Alexandria - ${version}`);
  mainWindow.loadFile('dist/index.html');
  
  // Maximize the window by default
  mainWindow.maximize();
  
  mainWindow.on('closed', () => {
    logger.info('Main window closed.');
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  logger.info('App is ready.');
  got = (await import('got')).default;
  Store = (await import('electron-store')).default;
  store = new Store();
  
  const downloads = store.get('downloads', []);
  const completedDownloads = downloads.filter(d => d.state === 'completed');
  store.set('downloads', completedDownloads);

  Store.initRenderer();

  // Set Dock icon on macOS during development
  if (process.platform === 'darwin' && !app.isPackaged) {
    try {
      app.dock.setIcon(path.join(__dirname, 'assets', 'icon.icns'));
    } catch (err) {
      logger.error('Failed to set Dock icon:', err);
    }
  }

  createStartupWindow();

  async function startLibgenCheck() {
    if (startupWindow) {
      logger.info('Performing LibGen access check...');
      try {
        const result = await testLibgenAccess(startupWindow, logger);
        if (result.success) {
          logger.info(`LibGen access check successful. Working mirror: ${result.workingMirror}`);
        } else {
          logger.warn(`LibGen access check failed: ${result.error}`);
        }
      } catch (error) {
        logger.error('Error during LibGen access check:', error);
      }
      setTimeout(() => {
        if (startupWindow) {
          startupWindow.close();
        }
        createWindow();
      }, 1000);
    }
  }

  const isMac = process.platform === 'darwin';
  if (app.isPackaged) {
    // Electron Forge auto-updater logic
    let updateHandled = false;
    function sendUpdateMessage(msg) {
      if (startupWindow) {
        startupWindow.webContents.send('update-message', msg);
      }
    }
    autoUpdater.on('checking-for-update', () => {
      sendUpdateMessage('Checking for updates...');
    });
    autoUpdater.on('update-available', (info) => {
      sendUpdateMessage('Update available. Downloading...');
    });
    autoUpdater.on('download-progress', (progressObj) => {
      const percent = Math.round(progressObj.percent);
      sendUpdateMessage(`Downloading update: ${percent}%`);
    });
    autoUpdater.on('update-not-available', (info) => {
      sendUpdateMessage('No updates available.');
      if (!updateHandled) {
        updateHandled = true;
        setTimeout(startLibgenCheck, 1000);
      }
    });
    autoUpdater.on('update-downloaded', async (info) => {
      if (isMac) {
        sendUpdateMessage('Update downloaded. Opening folder...');
        // Try to open the folder containing the downloaded ZIP
        const updateFile = info && info.downloadedFile ? info.downloadedFile : null;
        let folderToOpen = null;
        if (updateFile) {
          folderToOpen = path.dirname(updateFile);
        } else {
          // Fallback: open Downloads folder
          folderToOpen = app.getPath('downloads');
        }
        await shell.openPath(folderToOpen);
        dialog.showMessageBox({
          type: 'info',
          title: 'Update Ready',
          message: 'A new version has been downloaded. Please quit the app and replace it with the new version from the opened folder.',
          buttons: ['OK']
        });
        sendUpdateMessage('Update ready. Please replace the app and relaunch.');
        if (!updateHandled) {
          updateHandled = true;
          setTimeout(startLibgenCheck, 1000);
        }
      } else {
        sendUpdateMessage('Update downloaded. Restarting...');
        setTimeout(() => {
          autoUpdater.quitAndInstall();
        }, 1500);
      }
    });
    autoUpdater.on('error', (err) => {
      logger.error('Auto-updater error:', err);
      sendUpdateMessage('Update check failed.');
      if (!updateHandled) {
        updateHandled = true;
        setTimeout(startLibgenCheck, 1000);
      }
    });
    // Start update check
    autoUpdater.checkForUpdatesAndNotify();
    // Fallback: if update events don't fire, proceed after timeout
    setTimeout(() => {
      if (!updateHandled) {
        updateHandled = true;
        startLibgenCheck();
      }
    }, 20000);
  } else {
    // In development, skip update check but still do LibGen check
    setTimeout(startLibgenCheck, 1000);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      logger.info('App activated, creating new window.');
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  logger.info('All windows closed, quitting application.');
  app.quit();
});

ipcMain.on('minimize', () => {
  if (mainWindow) {
    logger.info('Minimizing main window.');
    mainWindow.minimize();
  }
});

ipcMain.on('maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      logger.info('Unmaximizing main window.');
      mainWindow.unmaximize();
    } else {
      logger.info('Maximizing main window.');
      mainWindow.maximize();
    }
  }
});

ipcMain.on('close', () => {
  if (mainWindow) {
    logger.info('Closing main window.');
    mainWindow.close();
  }
});

ipcMain.handle('search', async (event, query) => {
  logger.info(`Received search request for query: "${query}"`);
  const win = BrowserWindow.fromWebContents(event.sender);
  const results = await search(win, query, logger);
  logger.info(`Search for "${query}" returned ${results.length} results.`);
  return results;
});

ipcMain.handle('download', async (event, { book }) => {
  logger.info(`Download request for book: "${book.title}" (ID: ${book.client_id})`);
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
  logger.info(`Download item added and updated in store for "${book.title}"`);

  // DOI Download Logic
  if (book.doi) {
    try {
      logger.info(`Attempting to download DOI: ${book.doi}`);
      const directLink = await getSciHubDownloadLink(book.doi, logger);
      if (!directLink) {
        throw new Error('Could not resolve Sci-Hub download link');
      }

      logger.info(`Starting download for "${book.title}" from Sci-Hub link: ${directLink}`);
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
            logger.error(`Download failed for "${book.title}": ${error.message}`);
          } else {
            item.state = 'completed';
            logger.info(`Download completed for "${book.title}"`);
          }
          store.set('downloads', finalDownloads);
          win.webContents.send('downloads-updated', finalDownloads);
        }
        delete downloadItems[book.client_id];
      });
      return;
    } catch (error) {
      logger.error(`Error downloading DOI ${book.doi}:`, error);
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
      
      logger.info(`Attempting to get download links from mirror: ${downloadPageUrl}`);
      const downloadLinks = await getDownloadLinks(downloadPageUrl, logger);
      if (!downloadLinks || downloadLinks.length === 0) {
        throw new Error('No download links found');
      }

      logger.info(`Resolving direct download link from: ${downloadLinks[0]}`);
      const directLink = await resolveDirectDownloadLink(downloadLinks[0], logger);
      if (!directLink) {
        throw new Error('Could not resolve direct download link');
      }

      if (directLink.includes('slow_download')) {
        logger.info(`Handling slow download for "${book.title}", opening in browser.`);
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

      logger.info(`Starting download for "${book.title}" from direct link.`);
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
            logger.error(`Download failed for "${book.title}": ${error.message}`);
          } else {
            item.state = 'completed';
            logger.info(`Download completed for "${book.title}"`);
          }
          store.set('downloads', finalDownloads);
          win.webContents.send('downloads-updated', finalDownloads);
        }
        delete downloadItems[book.client_id];
      });
      return; // Exit the loop if download starts successfully
    } catch (error) {
      logger.error(`Error with mirror ${mirror} for book "${book.title}":`, error);
      // Continue to the next mirror
    }
  }

  // If all mirrors fail
  logger.error(`All mirrors failed for book: "${book.title}"`);
  const finalDownloads = store.get('downloads', []);
  const item = finalDownloads.find((d) => d.client_id === book.client_id);
  if (item) {
    item.state = 'failed';
    store.set('downloads', finalDownloads);
    win.webContents.send('downloads-updated', finalDownloads);
  }
});

ipcMain.handle('get-downloads', () => {
  logger.info('Fetching current downloads list.');
  return store.get('downloads', []);
});

ipcMain.handle('clear-downloads', () => {
  logger.info('Clearing completed downloads from the list.');
  const downloads = store.get('downloads', []);
  const inProgressDownloads = downloads.filter(d => d.state === 'downloading' || d.state === 'resolving');
  store.set('downloads', inProgressDownloads);
  return inProgressDownloads;
});

ipcMain.handle('cancel-download', (event, clientId) => {
  logger.info(`Canceling download for client ID: ${clientId}`);
  const downloadStream = downloadItems[clientId];
  if (downloadStream) {
    downloadStream.destroy();
    logger.info(`Download stream destroyed for client ID: ${clientId}`);
  }
  const downloads = store.get('downloads', []);
  const newDownloads = downloads.filter((d) => d.client_id !== clientId);
  store.set('downloads', newDownloads);
  return newDownloads;
});

ipcMain.handle('open-file', (event, filename) => {
  logger.info(`Request to open file: "${filename}"`);
  const downloads = store.get('downloads', []);
  const downloadItem = downloads.find((d) => d.filename === filename);
  if (downloadItem && downloadItem.state === 'completed') {
    shell.openPath(downloadItem.path);
  } else {
    logger.warn(`File not found or not completed: "${filename}"`);
  }
});

ipcMain.handle('open-folder', (event, filename) => {
  logger.info(`Request to open folder for file: "${filename}"`);
  const downloads = store.get('downloads', []);
  const downloadItem = downloads.find((d) => d.filename === filename);
  if (downloadItem && downloadItem.state === 'completed') {
    shell.showItemInFolder(downloadItem.path);
  } else {
    logger.warn(`File not found or not completed, cannot open folder: "${filename}"`);
  }
});

ipcMain.handle('open-link', (event, link) => {
  logger.info(`Opening external link: ${link}`);
  shell.openExternal(link);
});

ipcMain.handle('get-download-location', async () => {
  logger.info('Opening dialog to select download location.');
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  });
  if (canceled) {
    logger.info('Download location selection was canceled.');
    return null;
  } else {
    logger.info(`Download location selected: ${filePaths[0]}`);
    return filePaths[0];
  }
});

ipcMain.handle('get-version', () => {
  const version = app.getVersion();
  logger.info(`Fetching app version: ${version}`);
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
  return await testLibgenAccess(win, logger);
});

ipcMain.handle('open-logs-folder', () => {
  shell.openPath(LOGS_DIR);
});

ipcMain.handle('get-latest-log', async () => {
  const fs = require('fs');
  const path = require('path');
  const logPath = path.join(LOGS_DIR, 'log-latest.jsonl');
  try {
    if (fs.existsSync(logPath)) {
      return fs.readFileSync(logPath, 'utf8');
    } else {
      return '';
    }
  } catch (e) {
    return '';
  }
});

// Patch logger to emit log lines to renderer
const { info, warn, error, debug, verbose, log, LOGS_DIR, LEVELS } = logger;
function emitLogToRenderers(entry) {
  const { BrowserWindow } = require('electron');
  BrowserWindow.getAllWindows().forEach(win => {
    win.webContents.send('log-update', entry);
  });
}
LEVELS.forEach(level => {
  const orig = logger[level];
  logger[level] = (message, meta) => {
    orig(message, meta);
    try {
      const entry = {
        timestamp: new Date().toISOString(),
        level: level.toUpperCase(),
        message,
        ...(meta && Object.keys(meta || {}).length > 0 ? { meta } : {})
      };
      emitLogToRenderers(entry);
    } catch {}
  };
});

ipcMain.handle('check-for-updates', async () => {
  logger.info('User triggered check for updates from settings.');
  try {
    autoUpdater.checkForUpdatesAndNotify();
    return { success: true };
  } catch (error) {
    logger.error('Error checking for updates:', error);
    return { success: false, error: error.message };
  }
});

// Patch autoUpdater log output to also go to our logger
const origConsoleLog = console.log;
const origConsoleWarn = console.warn;
const origConsoleError = console.error;
const origConsoleInfo = console.info;

function patchAutoUpdaterLogging() {
  const logUpdate = (level, ...args) => {
    const msg = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
    if (msg && (msg.includes('checkForUpdates') || msg.includes('downloadPromise') || msg.includes('update'))) {
      logger.info(`[autoUpdater] ${msg}`);
    }
  };
  console.log = (...args) => { logUpdate('info', ...args); origConsoleLog(...args); };
  console.warn = (...args) => { logUpdate('warn', ...args); origConsoleWarn(...args); };
  console.error = (...args) => { logUpdate('error', ...args); origConsoleError(...args); };
  console.info = (...args) => { logUpdate('info', ...args); origConsoleInfo(...args); };
}

patchAutoUpdaterLogging();

ipcMain.handle('clear-app-data', async () => {
  try {
    logger.info('User triggered clear app data (store & logs) from settings.');
    // Clear electron-store
    if (store && typeof store.clear === 'function') {
      store.clear();
    }
    // Delete all log files
    const logDir = logger.LOGS_DIR;
    if (logDir && fs.existsSync(logDir)) {
      const files = fs.readdirSync(logDir);
      for (const file of files) {
        try {
          fs.unlinkSync(path.join(logDir, file));
        } catch (e) {
          logger.error('Failed to delete log file:', { file, error: e.message });
        }
      }
    }
    return { success: true };
  } catch (error) {
    logger.error('Error clearing app data:', error);
    return { success: false, error: error.message };
  }
});