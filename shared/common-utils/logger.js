/**
 * Structured JSON Logger for ShowTime Microservices
 */

const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const CURRENT_LEVEL = LOG_LEVELS[process.env.LOG_LEVEL || "info"] ?? LOG_LEVELS.info;

export function createLogger(serviceName = "service") {
  function formatLog(level, message, meta = {}) {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      service: serviceName,
      level: level.toUpperCase(),
      message: typeof message === "string" ? message : JSON.stringify(message),
      ...meta,
    });
  }

  return {
    info(msg, meta) {
      if (CURRENT_LEVEL >= LOG_LEVELS.info) console.log(formatLog("info", msg, meta));
    },
    warn(msg, meta) {
      if (CURRENT_LEVEL >= LOG_LEVELS.warn) console.warn(formatLog("warn", msg, meta));
    },
    error(msg, meta) {
      if (CURRENT_LEVEL >= LOG_LEVELS.error) console.error(formatLog("error", msg, meta));
    },
    debug(msg, meta) {
      if (CURRENT_LEVEL >= LOG_LEVELS.debug) console.log(formatLog("debug", msg, meta));
    },
  };
}

