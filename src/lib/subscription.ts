export const TRIAL_DAYS = 14;
export const GRACE_DAYS = 3;
export const PROMO_SLOTS = 10;
export const PROMO_PRICE = 5000;
export const PROMO_MONTHS = 3;

const DAY = 86_400_000;

export type AccessState =
  | { kind: "active"; until: Date; promo: boolean }
  | { kind: "trial"; daysLeft: number }
  | { kind: "grace"; daysLeft: number }
  | { kind: "blocked" };

export function computeAccess(
  createdAt: string | Date,
  sub: { paid_until: string | null; promo?: boolean } | null,
  now: Date = new Date(),
): AccessState {
  if (sub?.paid_until && new Date(sub.paid_until).getTime() > now.getTime()) {
    return { kind: "active", until: new Date(sub.paid_until), promo: !!sub.promo };
  }
  const trialEnd = new Date(createdAt).getTime() + TRIAL_DAYS * DAY;
  const graceEnd = trialEnd + GRACE_DAYS * DAY;
  const t = now.getTime();
  if (t < trialEnd) return { kind: "trial", daysLeft: Math.ceil((trialEnd - t) / DAY) };
  if (t < graceEnd) return { kind: "grace", daysLeft: Math.ceil((graceEnd - t) / DAY) };
  return { kind: "blocked" };
}

export function promoRemaining(promoCount: number) {
  return Math.max(0, PROMO_SLOTS - promoCount);
}
