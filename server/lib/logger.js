const pino = require('pino');

const isProduction = process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT;

const logger = pino({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  ...(isProduction ? {} : {
    transport: {
      target: 'pino/file',
      options: { destination: 1 }, // stdout
    },
  }),
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    service: 'guru-api',
    env: process.env.RAILWAY_ENVIRONMENT || 'local',
  },
});

// Create child loggers for different modules
function createLogger(module) {
  return logger.child({ module });
}

// Express request logging middleware
function requestLogger() {
  const pinoHttp = require('pino-http');
  return pinoHttp({
    logger,
    autoLogging: {
      ignore: (req) => {
        // Don't log health checks and static assets
        return req.url === '/health' || req.url === '/ready' || req.url?.startsWith('/assets/');
      },
    },
    customLogLevel: (req, res, err) => {
      if (res.statusCode >= 500 || err) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    customSuccessMessage: (req, res) => {
      return `${req.method} ${req.url} ${res.statusCode}`;
    },
    customErrorMessage: (req, res, err) => {
      return `${req.method} ${req.url} ${res.statusCode} - ${err.message}`;
    },
    serializers: {
      req: (req) => ({
        method: req.method,
        url: req.url,
        userId: req.raw?.user?.userId,
      }),
      res: (res) => ({
        statusCode: res.statusCode,
      }),
    },
  });
}

module.exports = {
  logger,
  createLogger,
  requestLogger,
};
