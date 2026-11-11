import { z } from 'zod';

export const uuidSchema = z.uuid();
export const emailSchema = z.email();
export const passwordSchema = z.string().min(10).max(128);

export const idParamSchema = z.object({ id: uuidSchema });

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
