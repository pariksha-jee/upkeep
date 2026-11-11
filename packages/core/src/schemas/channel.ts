import { z } from 'zod';
import { CHANNEL_TYPES, DEFAULTS, LIMITS, NOTIFY_EVENTS } from '../constants.js';
import { uuidSchema } from './common.js';

const labelField = z.string().min(1).max(LIMITS.channelLabelMax);

export const createChannelSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('EMAIL'),
    label: labelField,
    email: z.object({ to: z.email() }),
  }),
  z.object({
    type: z.literal('SMS'),
    label: labelField,
    sms: z.object({
      to: z.string().regex(/^\+[1-9]\d{7,14}$/, {
        message: 'phone number must be E.164 (e.g. +14155552671)',
      }),
    }),
  }),
  z.object({
    type: z.literal('WEBHOOK'),
    label: labelField,
    webhook: z.object({
      url: z.url().refine((v) => v.startsWith('https://') || v.startsWith('http://'), {
        message: 'webhook URL must be http(s)',
      }),
      secret: z.string().min(16).max(256).optional(),
    }),
  }),
]);
export type CreateChannelInput = z.infer<typeof createChannelSchema>;

export const updateChannelSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('EMAIL'),
    label: labelField.optional(),
    email: z.object({ to: z.email() }),
  }),
  z.object({
    type: z.literal('SMS'),
    label: labelField.optional(),
    sms: z.object({
      to: z.string().regex(/^\+[1-9]\d{7,14}$/, {
        message: 'phone number must be E.164 (e.g. +14155552671)',
      }),
    }),
  }),
  z.object({
    type: z.literal('WEBHOOK'),
    label: labelField.optional(),
    webhook: z.object({
      url: z.url().refine((v) => v.startsWith('https://') || v.startsWith('http://'), {
        message: 'webhook URL must be http(s)',
      }),
      secret: z.string().min(16).max(256).nullish(),
    }),
  }),
]);
export type UpdateChannelInput = z.infer<typeof updateChannelSchema>;

/** Per-monitor alert binding. */
export const bindingInputSchema = z.object({
  channelId: uuidSchema,
  notifyOnDown: z.boolean().default(true),
  notifyOnRecovery: z.boolean().default(true),
  cooldownMinutes: z
    .number()
    .int()
    .min(LIMITS.cooldownMinMinutes)
    .max(LIMITS.cooldownMaxMinutes)
    .default(DEFAULTS.cooldownMinutes),
});
export type BindingInput = z.infer<typeof bindingInputSchema>;

export const bindingsUpdateSchema = z.array(bindingInputSchema).max(LIMITS.channelsPerUser);
export type BindingsUpdateInput = z.infer<typeof bindingsUpdateSchema>;

export const channelTypeSchema = z.enum(CHANNEL_TYPES);
export const notifyEventSchema = z.enum(NOTIFY_EVENTS);
