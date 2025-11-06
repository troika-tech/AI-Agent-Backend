const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const loggingConfig = require('../config/logging');

const transports = [
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    ),
    level: loggingConfig.consoleLevel || 'info',
  }),
  new DailyRotateFile({
    filename: loggingConfig.file.filename || 'logs/app-%DATE%.log',
    datePattern: loggingConfig.file.datePattern || 'YYYY-MM-DD',
    zippedArchive: loggingConfig.file.zippedArchive || true,
    maxSize: loggingConfig.file.maxSize || '20m',
    maxFiles: loggingConfig.file.maxFiles || '14d',
    level: loggingConfig.file.level || 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
  })
];

const logger = winston.createLogger({
  level: loggingConfig.level || 'info',
  transports,
});

module.exports = logger;
