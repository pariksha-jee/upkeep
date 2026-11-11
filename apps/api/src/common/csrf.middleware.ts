import type { NextFunction, Request, RequestHandler, Response } from '../compat/express.js';
import { ForbiddenError } from '../shared/errors.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const ACCESS_COOKIE = 'upkeep_at';

/**
 * CSRF protection for cookie-authenticated sessions: state-changing requests
 * that carry the auth cookie (and no Authorization header) must include the
 * custom header `x-upkeep-csrf`. Cross-site form posts cannot set custom
 * headers; the web client attaches it automatically. Bearer clients and
 * cookie-less requests (login/register) are exempt.
 */
export const csrfMiddleware: RequestHandler = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }
  const usesBearer = req.headers.authorization !== undefined;
  const hasSessionCookie =
    typeof req.cookies?.[ACCESS_COOKIE] === 'string' && req.cookies[ACCESS_COOKIE].length > 0;
  if (usesBearer || !hasSessionCookie) {
    next();
    return;
  }
  if (req.headers['x-upkeep-csrf'] === '1') {
    next();
    return;
  }
  next(new ForbiddenError('Missing CSRF header'));
};
