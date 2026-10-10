import { describe, expect, it } from "vitest";
import { computeAccess, promoRemaining } from "./subscription";

const created = "2026-10-01T00:00:00Z";
const at = (d: string) => new Date(d);

describe("cycle d'abonnement", () => {
  it("essai de 14 jours", () => {
    expect(computeAccess(created, null, at("2026-10-14T12:00:00Z")).kind).toBe("trial");
  });
  it("3 jours d'alerte après l'essai", () => {
    const s = computeAccess(created, null, at("2026-10-15T12:00:00Z"));
    expect(s).toEqual({ kind: "grace", daysLeft: 3 });
    expect(computeAccess(created, null, at("2026-10-17T23:00:00Z")).kind).toBe("grace");
  });
  it("blocage au 18e jour sans paiement", () => {
    expect(computeAccess(created, null, at("2026-10-18T00:00:01Z")).kind).toBe("blocked");
  });
  it("paiement validé débloque", () => {
    expect(
      computeAccess(created, { paid_until: "2026-12-01T00:00:00Z" }, at("2026-11-01T00:00:00Z")).kind,
    ).toBe("active");
  });
  it("10 places promo", () => {
    expect(promoRemaining(3)).toBe(7);
    expect(promoRemaining(12)).toBe(0);
  });
});
