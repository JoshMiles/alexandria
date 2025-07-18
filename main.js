const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const logger = require('./backend/logger.js');
const fs = require('fs');
const { pipeline } = require('stream');
const os = require('os');
const https = require('https');
const axios = require('axios');
const { CookieJar } = require('tough-cookie');
const { wrapper } = require('axios-cookiejar-support');
const {
  saveTempLogFile,
  extractIsbns,
  parseFilename,
  isValidMetadata,
  scoreEdition,
  gotWithLog,
  fetchFileMetadata,
  fetchFileDownloadLinks,
  fetchBibtexMetadata,
  fetchAdsPhpMetadataAndCover,
  fetchLibgenFileCountsByIsbns, // <-- add import
  fetchLibgenFileCountByIsbn,
} = require('./backend/alexandria-lib.js');
const { autoUpdater } = require('electron-updater');
const cheerio = require('cheerio');

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
      preload: path.join(__dirname, 'preload.js'), // use root preload
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
      preload: path.join(__dirname, 'preload.js'), // use root preload
      contextIsolation: true,
      nodeIntegration: false,
    },
    backgroundColor: '#f7f8fa', // Set to match app background
  });

  const version = app.getVersion();
  mainWindow.setTitle(`Alexandria - ${version}`);
  mainWindow.loadFile('dist/index.html');
  mainWindow.maximize();
  mainWindow.on('closed', () => {
    logger.info('Main window closed.');
    mainWindow = null;
  });

  // Close the splash/startup window if it exists
  if (startupWindow) {
    startupWindow.close();
    startupWindow = null;
  }
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
        setTimeout(createWindow, 1000);
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
          setTimeout(createWindow, 1000);
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
        setTimeout(createWindow, 1000);
      }
    });
    // Start update check
    autoUpdater.checkForUpdatesAndNotify();
    // Fallback: if update events don't fire, proceed after timeout
    setTimeout(() => {
      if (!updateHandled) {
        updateHandled = true;
        createWindow();
      }
    }, 20000);
  } else {
    // In development, skip update check but still do LibGen check
    setTimeout(createWindow, 1000);
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
  const title = book.title || 'Unknown';
  const author = book.author || 'Unknown';
  const year = book.year || 'Unknown';
  const language = book.language || 'Unknown';
  const ext = book.extension || 'bin';
  const rawFileName = `${title} - ${author} (${year}) [${language}].${ext}`;
  const sanitizedFileName = rawFileName.replace(/[^ 0-9\w\s.\-\[\]]/g, '').trim();
  const filePath = path.join(downloadsPath, sanitizedFileName);

  // 1. Setup axios with cookie jar
  const jar = new CookieJar();
  const client = wrapper(axios.create({ jar }));

  try {
    // 2. Fetch ads.php to get cookies and the get.php link
    const adsUrl = `https://libgen.bz/ads.php?md5=${book.md5}`;
    const adsRes = await client.get(adsUrl, { responseType: 'text' });
    const html = adsRes.data;
    // Use cheerio to parse and filter <a> tags for the correct get.php link
    const $ = cheerio.load(html);
    let foundLink = null;
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (
        href &&
        href.startsWith('get.php?') &&
        href.includes(`md5=${book.md5}`) &&
        href.includes('key=')
      ) {
        foundLink = href;
        return false; // break loop
      }
    });
    if (!foundLink) throw new Error('Could not find get.php download link on ads.php page');
    const getUrl = `https://libgen.bz/${foundLink}`;

    // 3. Download the file using the cookies from ads.php
    const fileRes = await client.get(getUrl, {
      responseType: 'stream',
      headers: {
        'Referer': adsUrl,
        'User-Agent': 'Mozilla/5.0 (Electron Alexandria)'
      }
    });

    // 4. Save the file to disk and track progress
    const total = Number(fileRes.headers['content-length']) || 0;
    let transferred = 0;
    fileRes.data.on('data', chunk => {
      transferred += chunk.length;
      win.webContents.send('download-progress', {
        clientId: book.client_id,
        progress: {
          percent: total ? transferred / total : 0,
          transferred,
          total
        }
      });
    });

    await new Promise((resolve, reject) => {
      const stream = fs.createWriteStream(filePath);
      fileRes.data.pipe(stream);
      fileRes.data.on('end', resolve);
      fileRes.data.on('error', reject);
    });

    // 5. Notify renderer of completion
    win.webContents.send('downloads-updated', [{
      ...book,
      filename: sanitizedFileName,
      path: filePath,
      state: 'completed',
      progress: { percent: 1, transferred: total, total }
    }]);
    logger.info(`Download completed for "${book.title}"`);
    return { success: true, filePath };
  } catch (err) {
    logger.error(`Download failed for "${book.title}": ${err}`);
    win.webContents.send('downloads-updated', [{
      ...book,
      filename: sanitizedFileName,
      path: filePath,
      state: 'failed',
      progress: { percent: 0, transferred: 0, total: 0 }
    }]);
    return { success: false, error: err.message || String(err) };
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

ipcMain.handle('log', (event, { level, message, meta }) => {
  if (typeof logger[level] === 'function') {
    logger[level](message, meta);
  } else {
    logger.info(message, meta);
  }
  return true;
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

// Guard to prevent recursive logging
let isAutoUpdaterLogging = false;

function patchAutoUpdaterLogging() {
  const logUpdate = (level, ...args) => {
    if (isAutoUpdaterLogging) return; // Prevent recursion
    const msg = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
    if (msg && (msg.includes('checkForUpdates') || msg.includes('downloadPromise') || msg.includes('update'))) {
      isAutoUpdaterLogging = true;
      try {
        // Use the original logger.info to avoid recursion
        info(`[autoUpdater] ${msg}`);
      } finally {
        isAutoUpdaterLogging = false;
      }
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

ipcMain.handle('fetchLibgenFileCountByIsbn', async (event, isbn) => {
  return await fetchLibgenFileCountByIsbn(isbn);
});