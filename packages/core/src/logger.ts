import pino from 'pino';
import { loadConfig } from './config/index.js';

export function createLogger(name: string) {
  const cfg = loadConfig();
  return pino({
    name,
    level: cfg.LOG_LEVEL,
  });
}
