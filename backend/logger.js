const fs = require('fs');
const path = require('path');

const LOGS_DIR = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR);
}

function getTimestamp() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const time = now.toISOString().replace(/:/g, '-').slice(11, 19);
  return `${date}-${time}`;
}

function rotateLogs() {
  const files = fs.readdirSync(LOGS_DIR)
    .filter(f => f.startsWith('log-') && f.endsWith('.txt') && f !== 'log-latest.txt')
    .sort((a, b) => fs.statSync(path.join(LOGS_DIR, b)).mtimeMs - fs.statSync(path.join(LOGS_DIR, a)).mtimeMs);
  if (files.length >= 10) {
    for (let i = 9; i < files.length; i++) {
      fs.unlinkSync(path.join(LOGS_DIR, files[i]));
    }
  }
}

function archiveLatestLog() {
  const latestPath = path.join(LOGS_DIR, 'log-latest.txt');
  if (fs.existsSync(latestPath)) {
    const newName = `log-${getTimestamp()}.txt`;
    fs.renameSync(latestPath, path.join(LOGS_DIR, newName));
    rotateLogs();
  }
}

archiveLatestLog();
const logFile = fs.createWriteStream(path.join(LOGS_DIR, 'log-latest.txt'), { flags: 'a' });

function logToFile(level, ...args) {
  const msg = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${args.map(a => (typeof a === 'string' ? a : JSON.stringify(a, null, 2))).join(' ')}\n`;
  logFile.write(msg);
}

function info(...args) {
  console.info('[INFO]', ...args);
  logToFile('info', ...args);
}

function warn(...args) {
  console.warn('[WARN]', ...args);
  logToFile('warn', ...args);
}

function error(...args) {
  console.error('[ERROR]', ...args);
  logToFile('error', ...args);
}

module.exports = { info, warn, error, LOGS_DIR }; 