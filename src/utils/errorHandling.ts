// Note: electron-log types are imported dynamically to avoid module resolution issues
type Logger = {
  info: (message: string, ...args: any[]) => void;
  error: (message: string, ...args: any[]) => void;
  warn: (message: string, ...args: any[]) => void;
};

export interface AppError {
  message: string;
  code?: string;
  originalError?: Error;
}

/**
 * Creates a standardized error object
 */
export const createError = (message: string, code?: string, originalError?: Error): AppError => {
  return {
    message,
    code,
    originalError
  };
};

/**
 * Logs error with consistent format
 */
export const logError = (logger: Logger, context: string, error: Error | AppError | string, additionalInfo?: any): void => {
  const errorMessage = typeof error === 'string' ? error : error.message;
  logger.error(`[${context}] ${errorMessage}`, { error, additionalInfo });
};

/**
 * Handles HTTP request errors with retry logic
 */
export const handleHttpError = (error: any, url: string, logger: Logger): AppError => {
  if (error.response) {
    // Server responded with error status
    const message = `HTTP ${error.response.status}: ${error.response.statusText} for ${url}`;
    logError(logger, 'HTTP_ERROR', message, { status: error.response.status, url });
    return createError(message, 'HTTP_ERROR', error);
  } else if (error.request) {
    // Request was made but no response received
    const message = `Network error when requesting ${url}`;
    logError(logger, 'NETWORK_ERROR', message, { url });
    return createError(message, 'NETWORK_ERROR', error);
  } else {
    // Error in setting up the request
    const message = `Request setup error for ${url}: ${error.message}`;
    logError(logger, 'REQUEST_ERROR', message, { url });
    return createError(message, 'REQUEST_ERROR', error);
  }
};

/**
 * Safely executes an async function with error handling
 */
export const safeAsync = async <T>(
  fn: () => Promise<T>,
  fallback: T,
  logger: Logger,
  context: string
): Promise<T> => {
  try {
    return await fn();
  } catch (error) {
    logError(logger, context, error as Error);
    return fallback;
  }
};