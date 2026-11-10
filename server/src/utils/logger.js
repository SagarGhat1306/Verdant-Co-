// One JSON line per log entry, easy to search in Vercel's logs.
// Log IDs, never secrets, tokens or full message text.
function write(level, message, context = {}) {
  const entry = {
    time: new Date().toISOString(),
    level,
    message,
    ...context,
  };
  const line = JSON.stringify(entry);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export function errorContext(error) {
  if (!error) return {};
  return {
    errorName: error.name,
    errorMessage: error.message,
    errorCode: error.code,
    ...(process.env.NODE_ENV !== 'production' && error.stack ? { stack: error.stack } : {}),
  };
}

export const logger = {
  info: (message, context) => write('info', message, context),
  warn: (message, context) => write('warn', message, context),
  error: (message, context) => write('error', message, context),
};
