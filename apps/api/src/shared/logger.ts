import pino from 'pino';
import { env } from '../config/env.js';

/** Structured JSON logging (guardrails §9.1). Plain console.* is banned in src. */
export const logger = pino({
  level: env.NODE_ENV === 'test' ? 'silent' : env.LOG_LEVEL,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'configCipher',
      'privateKey',
      'openvpnConfig',
      'signedUrl',
      '*.configCipher',
      '*.privateKey',
      '*.openvpnConfig',
      '*.signedUrl',
    ],
    censor: '[redacted]',
  },
  base: { service: process.env.UPKEEP_ROLE ?? 'api' },
});
