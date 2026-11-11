import { SetMetadata, type ExecutionContext, createParamDecorator } from '@nestjs/common';
import type { Request } from '../compat/express.js';

export const IS_PUBLIC_KEY = 'upkeep:isPublic';
export const Public = (): MethodDecorator => SetMetadata(IS_PUBLIC_KEY, true);

export interface SessionUser {
  id: string;
  role: 'USER' | 'ADMIN';
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): SessionUser => {
    const req = ctx.switchToHttp().getRequest<Request>();
    if (req.user === undefined) {
      throw new Error('CurrentUser used outside an authenticated route');
    }
    return req.user;
  },
);
