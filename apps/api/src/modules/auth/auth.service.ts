import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hash, verify } from 'argon2';
import { randomUUID } from 'node:crypto';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
  type AuthTokensDto,
  type LoginInput,
  type RegisterInput,
  type UserDto,
} from '@upkeep/core';
import { PrismaService } from '../../shared/prisma.service.js';
import { generateToken, sha256Hex } from '../../shared/crypto.js';
import { ConflictError, UnauthorizedError } from '../../shared/errors.js';

export function toUserDto(u: {
  id: string;
  email: string;
  name: string;
  role: 'USER' | 'ADMIN';
  createdAt: Date;
}): UserDto {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    createdAt: u.createdAt.toISOString(),
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(input: RegisterInput): Promise<AuthTokensDto> {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existing !== null) {
      throw new ConflictError('An account with this email already exists');
    }
    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        passwordHash: await hash(input.password),
      },
    });
    return this.issueTokens(user.id, user.role);
  }

  async login(input: LoginInput): Promise<AuthTokensDto> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    // Constant-ish behaviour: always run a hash comparison to avoid trivial timing leaks.
    const dummy = '$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHQ$hash';
    const ok =
      user !== null
        ? await verify(user.passwordHash, input.password).catch(() => false)
        : await verify(dummy, input.password).catch(() => false);
    if (user === null || !ok) {
      throw new UnauthorizedError('Invalid email or password');
    }
    return this.issueTokens(user.id, user.role);
  }

  /** Rotating refresh with reuse detection: a replayed token kills the family. */
  async refresh(rawToken: string): Promise<AuthTokensDto> {
    const tokenHash = sha256Hex(rawToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (stored === null || stored.expiresAt < new Date()) {
      throw new UnauthorizedError('Invalid refresh token');
    }
    if (stored.revokedAt !== null) {
      // Reuse of a rotated token → revoke the entire family.
      await this.prisma.refreshToken.updateMany({
        where: { familyId: stored.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedError('Session expired, please sign in again');
    }
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    return this.issueTokens(stored.user.id, stored.familyId);
  }

  async logout(rawToken: string | undefined): Promise<void> {
    if (rawToken === undefined) return;
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: sha256Hex(rawToken) },
    });
    if (stored === null) return;
    await this.prisma.refreshToken.updateMany({
      where: { familyId: stored.familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async me(userId: string): Promise<UserDto> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user === null) throw new UnauthorizedError('Account no longer exists');
    return toUserDto(user);
  }

  private async issueTokens(userId: string, familyId?: string): Promise<AuthTokensDto> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user === null) throw new UnauthorizedError('Account no longer exists');

    const accessToken = await this.jwt.signAsync(
      { sub: user.id, role: user.role, type: 'access' },
      { expiresIn: ACCESS_TOKEN_TTL_SECONDS },
    );
    const refreshToken = generateToken();
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: sha256Hex(refreshToken),
        familyId: familyId ?? randomUUID(),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000),
      },
    });
    return { accessToken, refreshToken, user: toUserDto(user) };
  }
}
