import { z } from 'zod';
import { emailSchema, passwordSchema } from './common.js';

export const registerSchema = z.object({
  name: z.string().min(1).max(100),
  email: emailSchema,
  password: passwordSchema,
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

/** Refresh token is optional in the body: web clients use the httpOnly cookie. */
export const refreshSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});
export type RefreshInput = z.infer<typeof refreshSchema>;

export const updateProfileSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    currentPassword: z.string().min(1).optional(),
    newPassword: passwordSchema.optional(),
  })
  .refine((v) => v.newPassword === undefined || v.currentPassword !== undefined, {
    message: 'currentPassword is required when setting a new password',
  });
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
