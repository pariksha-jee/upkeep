import { z } from 'zod';
import { DEVICE_PLATFORMS } from '../constants.js';

export const registerDeviceSchema = z.object({
  platform: z.enum(DEVICE_PLATFORMS),
  pushToken: z.string().min(10).max(4096),
  appVersion: z.string().max(32).optional(),
});
export type RegisterDeviceInput = z.infer<typeof registerDeviceSchema>;
