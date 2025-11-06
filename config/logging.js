module.exports = {
  level: 'info',
  consoleLevel: 'debug',
  file: {
    filename: 'logs/app-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '14d',
    level: 'info',
  },
};
