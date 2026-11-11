import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from '../compat/express.js';

/** Attaches an x-request-id to every request; echoed in responses and errors. */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.headers['x-request-id'];
  const id = typeof incoming === 'string' && incoming.length > 0 ? incoming : randomUUID();
  req.requestId = id;
  res.setHeader('x-request-id', id);
  next();
}
