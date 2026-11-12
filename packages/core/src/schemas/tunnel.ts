import { z } from 'zod';
import { CREDENTIAL_PROVIDERS, DEFAULTS, LIMITS, TUNNEL_TYPES } from '../constants.js';
import { hasUnsafeOpenVpnDirectives } from '../logic/openvpn-sanitize.js';

const nameField = z.string().min(1).max(LIMITS.tunnelNameMax);

/** SSH reachability of the bastion/host (public side — never encrypted, never secret). */
export const sshTargetSchema = z.object({
  host: z.string().min(1).max(253),
  port: z.number().int().min(1).max(65535).default(DEFAULTS.sshPort),
  username: z.string().min(1).max(64),
  passphrase: z.string().min(1).max(128).optional(),
});
export type SshTarget = z.infer<typeof sshTargetSchema>;

/** Customer-generated signed URL pointing at the credential file. */
export const signedUrlSchema = z.object({
  provider: z.enum(CREDENTIAL_PROVIDERS),
  url: z.url().refine((v) => v.startsWith('https://'), {
    message: 'signed URLs must use HTTPS',
  }),
});
export type SignedUrlSource = z.infer<typeof signedUrlSchema>;

const privateKeySchema = z
  .string()
  .min(64)
  .max(64_000)
  .refine((k) => k.includes('PRIVATE KEY'), {
    message: 'value does not look like a PEM/OpenSSH private key',
  });

const openVpnConfigSchema = z
  .string()
  .min(16)
  .max(128_000)
  .refine((c) => /^(client|dev |proto |remote )/m.test(c), {
    message: 'value does not look like an OpenVPN client config',
  })
  // Static message: function-form messages can throw during issue creation.
  .refine((c) => hasUnsafeOpenVpnDirectives(c).length === 0, {
    message:
      'config contains disallowed directives — scripts, routes, proxies and similar directives are rejected for security',
  });

/**
 * Credential modes are discriminated FIRST (INLINE vs SIGNED_URL), then tunnel
 * type — two levels because both dimensions vary independently.
 */
const inlineTunnelSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('SSH'),
    name: nameField,
    credentialSource: z.literal('INLINE'),
    ssh: sshTargetSchema,
    privateKey: privateKeySchema,
  }),
  z.object({
    type: z.literal('OPENVPN'),
    name: nameField,
    credentialSource: z.literal('INLINE'),
    openvpnConfig: openVpnConfigSchema,
  }),
]);

const signedUrlTunnelSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('SSH'),
    name: nameField,
    credentialSource: z.literal('SIGNED_URL'),
    ssh: sshTargetSchema,
    signedUrl: signedUrlSchema,
  }),
  z.object({
    type: z.literal('OPENVPN'),
    name: nameField,
    credentialSource: z.literal('SIGNED_URL'),
    signedUrl: signedUrlSchema,
  }),
]);

export const createTunnelSchema = z.discriminatedUnion('credentialSource', [
  inlineTunnelSchema,
  signedUrlTunnelSchema,
]);
export type CreateTunnelInput = z.infer<typeof createTunnelSchema>;

/** Rotation-friendly update: rename, replace signed URL, rotate inline key, update SSH host. */
export const updateTunnelSchema = z
  .object({
    name: nameField.optional(),
    signedUrl: signedUrlSchema.optional(),
    privateKey: privateKeySchema.optional(),
    openvpnConfig: openVpnConfigSchema.optional(),
    ssh: sshTargetSchema.partial().optional(),
  })
  .refine((v) => Object.values(v).some((val) => val !== undefined) || Object.keys(v).length === 0, {
    message: 'at least one field is required',
  });
export type UpdateTunnelInput = z.infer<typeof updateTunnelSchema>;

export const tunnelTypeSchema = z.enum(TUNNEL_TYPES);
