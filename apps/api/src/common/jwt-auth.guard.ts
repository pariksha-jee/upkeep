import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from '../compat/express.js';
import { UnauthorizedError } from '../shared/errors.js';
import { IS_PUBLIC_KEY, type SessionUser } from './decorators.js';

export const ACCESS_COOKIE = 'upkeep_at';

interface AccessPayload {
  sub: string;
  role: SessionUser['role'];
  type: 'access';
}

/**
 * Global authentication guard. Fails closed: any error denies access.
 * Accepts `Authorization: Bearer <jwt>` (mobile/api-client) or the httpOnly
 * `upkeep_at` cookie (web dashboard).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const header = req.headers.authorization;
    let token: string | undefined;
    if (header !== undefined && header.startsWith('Bearer ')) {
      token = header.slice('Bearer '.length);
    } else if (typeof req.cookies?.[ACCESS_COOKIE] === 'string') {
      token = req.cookies[ACCESS_COOKIE];
    }

    if (token === undefined || token.length === 0) {
      throw new UnauthorizedError('Authentication required');
    }

    try {
      const payload = this.jwt.verify<AccessPayload>(token);
      if (payload.type !== 'access') {
        throw new Error('wrong token type');
      }
      req.user = { id: payload.sub, role: payload.role };
      return true;
    } catch {
      throw new UnauthorizedError('Invalid or expired session');
    }
  }
}
