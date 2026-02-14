import winston from 'winston';
import path from 'node:path';
import { mkdir } from 'node:fs/promises';

const logDir = path.join(process.cwd(), 'logs');

await mkdir(logDir, { recursive: true }).catch(() => {});

const consoleFormat = winston.format.printf(({ level, message, timestamp, error, ...rest }) => {
  let log = `${level}: ${message}`;
  if (error) {
    if (error instanceof Error) {
      log += ` - ${error.message}`;
      if (error.stack) log += `\n${error.stack}`;
    } else if (typeof error === 'object' && error !== null && 'message' in error) {
      log += ` - ${(error as { message: string }).message}`;
    } else {
      log += ` - ${JSON.stringify(error)}`;
    }
  }
  const extra = Object.keys(rest).filter((k) => k !== 'timestamp');
  if (extra.length > 0) {
    const extraData = extra.reduce((acc, k) => ({ ...acc, [k]: rest[k] }), {});
    log += ` ${JSON.stringify(extraData)}`;
  }
  return log;
});

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
    }),
  ],
});

logger.add(
  new winston.transports.Console({
    format: winston.format.combine(winston.format.colorize(), consoleFormat),
  })
);
