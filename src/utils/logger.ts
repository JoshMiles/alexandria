// Simple frontend logger that sends logs to the backend via window.electron.log
// Falls back to console if not available

type LogLevel = 'info' | 'warn' | 'error' | 'debug' | 'verbose';

function log(level: LogLevel, message: string, meta?: any) {
  const electronAny = window.electron as any;
  if (electronAny && typeof electronAny.log === 'function') {
    electronAny.log(level, message, meta);
  } else {
    // Fallback to console
    const msg = `[${level.toUpperCase()}] ${message}` + (meta ? ` ${JSON.stringify(meta)}` : '');
    if (level === 'error') {
      console.error(msg);
    } else if (level === 'warn') {
      console.warn(msg);
    } else {
      console.info(msg);
    }
  }
}

export const logger = {
  info: (message: string, meta?: any) => log('info', message, meta),
  warn: (message: string, meta?: any) => log('warn', message, meta),
  error: (message: string, meta?: any) => log('error', message, meta),
  debug: (message: string, meta?: any) => log('debug', message, meta),
  verbose: (message: string, meta?: any) => log('verbose', message, meta),
}; 