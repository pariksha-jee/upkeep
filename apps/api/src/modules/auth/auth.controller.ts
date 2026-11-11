import { Body, Controller, Get, HttpCode, Post, Res, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Response } from '../../compat/express.js';
import {
  loginSchema,
  refreshSchema,
  registerSchema,
  type AuthTokensDto,
  type LoginInput,
  type RefreshInput,
  type RegisterInput,
  type UserDto,
} from '@upkeep/core';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { CurrentUser, Public, type SessionUser } from '../../common/decorators.js';
import { AuthService } from './auth.service.js';
import { clearAuthCookies, REFRESH_COOKIE, setAuthCookies } from './cookies.js';
import { UnauthorizedError } from '../../shared/errors.js';

const AUTH_THROTTLE = { default: { limit: 10, ttl: 60_000 } };

@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @Public()
  @Throttle(AUTH_THROTTLE)
  async register(
    @Body(new ZodValidationPipe(registerSchema)) body: RegisterInput,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthTokensDto> {
    const tokens = await this.auth.register(body);
    setAuthCookies(res, tokens);
    return tokens;
  }

  @Post('login')
  @Public()
  @Throttle(AUTH_THROTTLE)
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginInput,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthTokensDto> {
    const tokens = await this.auth.login(body);
    setAuthCookies(res, tokens);
    return tokens;
  }

  @Post('refresh')
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async refresh(
    @Body(new ZodValidationPipe(refreshSchema)) body: RefreshInput,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthTokensDto> {
    const cookieToken = res.req?.cookies?.[REFRESH_COOKIE];
    const raw = body.refreshToken ?? (typeof cookieToken === 'string' ? cookieToken : undefined);
    if (raw === undefined) {
      throw new UnauthorizedError('Missing refresh token');
    }
    const tokens = await this.auth.refresh(raw);
    setAuthCookies(res, tokens);
    return tokens;
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Res({ passthrough: true }) res: Response): Promise<{ loggedOut: true }> {
    const cookieToken = res.req?.cookies?.[REFRESH_COOKIE];
    const raw = typeof cookieToken === 'string' ? cookieToken : undefined;
    await this.auth.logout(raw);
    clearAuthCookies(res);
    return { loggedOut: true };
  }

  @Get('me')
  async me(@CurrentUser() user: SessionUser): Promise<UserDto> {
    return this.auth.me(user.id);
  }
}
