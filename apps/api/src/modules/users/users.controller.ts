import { Body, Controller, Patch } from '@nestjs/common';
import { hash, verify } from 'argon2';
import { updateProfileSchema, type UpdateProfileInput, type UserDto } from '@upkeep/core';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { CurrentUser, type SessionUser } from '../../common/decorators.js';
import { PrismaService } from '../../shared/prisma.service.js';
import { UnauthorizedError } from '../../shared/errors.js';
import { toUserDto } from '../auth/auth.service.js';

@Controller('users')
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  @Patch('me')
  async updateProfile(
    @CurrentUser() user: SessionUser,
    @Body(new ZodValidationPipe(updateProfileSchema)) body: UpdateProfileInput,
  ): Promise<UserDto> {
    const current = await this.prisma.user.findUnique({ where: { id: user.id } });
    if (current === null) throw new UnauthorizedError('Account no longer exists');

    if (body.newPassword !== undefined) {
      const ok = await verify(current.passwordHash, body.currentPassword ?? '').catch(() => false);
      if (!ok) throw new UnauthorizedError('Current password is incorrect');
    }

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.newPassword !== undefined ? { passwordHash: await hash(body.newPassword) } : {}),
      },
    });
    return toUserDto(updated);
  }
}
