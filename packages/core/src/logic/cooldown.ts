/**
 * Notification cooldown evaluation — pure, so web/mobile can preview the same
 * behaviour the worker enforces.
 */
export function shouldNotify(
  lastNotifiedAt: Date | null,
  cooldownMinutes: number,
  now: Date,
): boolean {
  if (lastNotifiedAt === null) return true;
  if (cooldownMinutes <= 0) return true;
  return now.getTime() - lastNotifiedAt.getTime() >= cooldownMinutes * 60_000;
}
