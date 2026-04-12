import winston from "winston";
import type { LogLevel } from "../types/index.js";

let loggerInstance: winston.Logger | null = null;

/**
 * Creates and configures the Winston logger singleton.
 * Supports both structured JSON logging (production) and pretty console output.
 */
function createLogger(level: LogLevel = "info", structured = false): winston.Logger {
  const transports: winston.transport[] = [
    new winston.transports.Console({
      format: structured
        ? winston.format.combine(winston.format.timestamp(), winston.format.json())
        : winston.format.combine(
            winston.format.colorize(),
            winston.format.timestamp({ format: "HH:mm:ss" }),
            winston.format.printf(({ level: lvl, message, timestamp, ...meta }) => {
              const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
              return `${timestamp} [${lvl}] ${message}${metaStr}`;
            })
          ),
    }),
  ];

  return winston.createLogger({
    level,
    transports,
    exitOnError: false,
  });
}

/** Initialise or replace the logger with the given settings. */
export function initLogger(level: LogLevel = "info", structured = false): void {
  loggerInstance = createLogger(level, structured);
}

/** Get the logger instance, initialising with defaults if necessary. */
export function getLogger(): winston.Logger {
  if (!loggerInstance) {
    loggerInstance = createLogger();
  }
  return loggerInstance;
}

/** Convenience wrappers */
export const logger = {
  debug: (msg: string, meta?: Record<string, unknown>) => getLogger().debug(msg, meta),
  info: (msg: string, meta?: Record<string, unknown>) => getLogger().info(msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => getLogger().warn(msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => getLogger().error(msg, meta),
};
