const isDebugMode = process.env.NODE_ENV === 'development';

export const debugLogger = (...args: any[]) => {
  if (isDebugMode) {
    console.log('[DEBUG]', ...args);
  }
};

export const debugError = (...args: any[]) => {
  if (isDebugMode) {
    console.error('[ERROR]', ...args);
  }
};

export const debugWarn = (...args: any[]) => {
  if (isDebugMode) {
    console.warn('[WARN]', ...args);
  }
};

export const debugLogAuth = (email: string, message: string) => {
  if (isDebugMode) {
    console.log(`[AUTH] User: ${email} - ${message}`);
  }
};

export const debugLogSession = (session: any) => {
  if (isDebugMode) {
    console.log('[SESSION]', session);
  }
};
