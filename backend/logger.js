const fs = require('fs');
const path = require('path');

let LOGS_DIR;
try {
  // Try to use Electron's app.getPath('userData') if available
  const electron = require('electron');
  const app = electron.app || (electron.remote && electron.remote.app);
  if (app && app.getPath) {
    LOGS_DIR = path.join(app.getPath('userData'), 'logs');
  } else {
    LOGS_DIR = path.join(__dirname, '..', 'logs');
  }
} catch (e) {
  // Fallback for non-Electron/test environments
  LOGS_DIR = path.join(__dirname, '..', 'logs');
}

const MAX_LOG_FILES = 10; // configurable max log count

if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

function getTimestamp() {
  return new Date().toISOString();
}

function rotateLogs() {
  try {
    const files = fs.readdirSync(LOGS_DIR)
      .filter(f => f.startsWith('log-') && f.endsWith('.jsonl') && f !== 'log-latest.jsonl')
      .sort((a, b) => fs.statSync(path.join(LOGS_DIR, b)).mtimeMs - fs.statSync(path.join(LOGS_DIR, a)).mtimeMs);
    if (files.length >= MAX_LOG_FILES) {
      for (let i = MAX_LOG_FILES - 1; i < files.length; i++) {
        fs.unlinkSync(path.join(LOGS_DIR, files[i]));
      }
    }
  } catch (err) {
    // Don't throw on log rotation errors
    console.error('[LOGGER] Log rotation error:', err);
  }
}

function archiveLatestLog() {
  const latestPath = path.join(LOGS_DIR, 'log-latest.jsonl');
  if (fs.existsSync(latestPath)) {
    const newName = `log-${getTimestamp().replace(/[:.]/g, '-')}.jsonl`;
    try {
      fs.renameSync(latestPath, path.join(LOGS_DIR, newName));
      rotateLogs();
    } catch (err) {
      console.error('[LOGGER] Archive log error:', err);
    }
  }
}

archiveLatestLog();
let logFile;
try {
  logFile = fs.createWriteStream(path.join(LOGS_DIR, 'log-latest.jsonl'), { flags: 'a' });
} catch (err) {
  console.error('[LOGGER] Failed to open log file:', err);
}

const LEVELS = ['error', 'warn', 'info', 'verbose', 'debug'];

function log(level, message, meta = {}) {
  if (!LEVELS.includes(level)) level = 'info';
  const entry = {
    timestamp: getTimestamp(),
    level: level.toUpperCase(),
    message,
    ...((meta && Object.keys(meta).length > 0) ? { meta } : {})
  };
  const line = JSON.stringify(entry) + '\n';
  // Write to file async, but don't await
  if (logFile) {
    logFile.write(line, err => {
      if (err) console.error('[LOGGER] Write error:', err);
    });
  }
  // Also log to console
  const consoleMsg = `[${entry.timestamp}] [${entry.level}] ${entry.message}` + (meta && Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '');
  if (level === 'error') {
    console.error(consoleMsg);
  } else if (level === 'warn') {
    console.warn(consoleMsg);
  } else if (level === 'info') {
    console.info(consoleMsg);
  } else {
    console.log(consoleMsg);
  }
}

function info(message, meta) {
  log('info', message, meta);
}
function warn(message, meta) {
  log('warn', message, meta);
}
function error(message, meta) {
  log('error', message, meta);
}
function debug(message, meta) {
  log('debug', message, meta);
}
function verbose(message, meta) {
  log('verbose', message, meta);
}

module.exports = {
  log,
  info,
  warn,
  error,
  debug,
  verbose,
  LOGS_DIR,
  LEVELS,
}; 