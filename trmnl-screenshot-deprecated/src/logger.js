/**
 * Logging utility for TRMNL Screenshot Addon
 * Uses winston for structured logging with console output and file logging
 */

import winston from "winston";
import path from "path";
import fs from "fs";

const dataPath = process.env.DATA_PATH || "/data";
const logsPath = path.join(dataPath, "logs");

// Create logs directory if it doesn't exist
if (!fs.existsSync(logsPath)) {
  fs.mkdirSync(logsPath, { recursive: true });
}

const logLevel = process.env.LOG_LEVEL || "info";

/**
 * Create a formatted logger instance
 */
const logger = winston.createLogger({
  level: logLevel,
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json(),
  ),
  defaultMeta: { service: "trmnl-screenshot" },
  transports: [
    // Console output with simpler format
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, _service, ...meta }) => {
          let logMessage = `[${timestamp}] ${level}: ${message}`;
          // _service is from defaultMeta but not included in output
          if (Object.keys(meta).length > 0) {
            logMessage += ` ${JSON.stringify(meta)}`;
          }
          return logMessage;
        }),
      ),
    }),

    // File logging for errors
    new winston.transports.File({
      filename: path.join(logsPath, "error.log"),
      level: "error",
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),

    // File logging for all logs
    new winston.transports.File({
      filename: path.join(logsPath, "combined.log"),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
});

/**
 * Log sensitive operation without exposing full data
 * @param {string} operation - Operation name
 * @param {boolean} success - Whether operation succeeded
 * @param {object} meta - Metadata (excludes sensitive values)
 */
logger.logOperation = (operation, success, meta = {}) => {
  const level = success ? "info" : "warn";
  logger[level](`${operation}: ${success ? "success" : "failure"}`, meta);
};

/**
 * Log token-related info without exposing actual token
 * @param {string} deviceId - Device ID
 * @param {string} operation - Token operation (validate, generate, rotate)
 * @param {boolean} success - Whether operation succeeded
 * @param {string} reason - Reason for failure (if applicable)
 */
logger.logToken = (deviceId, operation, success, reason = "") => {
  const logLevel = success ? "debug" : "warn";
  let message = `Token ${operation} for device ${deviceId}: ${success ? "OK" : "FAILED"}`;
  if (reason) {
    message += ` (${reason})`;
  }
  logger[logLevel](message);
};

export default logger;
