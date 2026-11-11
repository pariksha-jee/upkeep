import type { Response } from '../../compat/express.js';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
  type AuthTokensDto,
} from '@upkeep/core';
import { isProduction } from '../../config/env.js';

export const ACCESS_COOKIE = 'upkeep_at';
export const REFRESH_COOKIE = 'upkeep_rt';

/**
 * Web sessions live in httpOnly cookies (lax CSRF posture + csrf middleware).
 * Mobile clients ignore cookies and use the JSON tokens.
 */
export function setAuthCookies(res: Response, tokens: AuthTokensDto): void {
  const base = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: isProduction,
  };
  res.cookie(ACCESS_COOKIE, tokens.accessToken, {
    ...base,
    path: '/v1',
    maxAge: ACCESS_TOKEN_TTL_SECONDS * 1000,
  });
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
    ...base,
    path: '/v1/auth',
    maxAge: REFRESH_TOKEN_TTL_SECONDS * 1000,
  });
}

export function clearAuthCookies(res: Response): void {
  const base = { httpOnly: true, sameSite: 'lax' as const, secure: isProduction };
  res.clearCookie(ACCESS_COOKIE, { ...base, path: '/v1' });
  res.clearCookie(REFRESH_COOKIE, { ...base, path: '/v1/auth' });
}
