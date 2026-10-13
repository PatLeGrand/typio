import { describe, expect, it } from "vitest";
import { decideQuota, formatReset, parseRateLimits, type RateLimits } from "./limits";

const RESET = 1791530831;

function limits(overrides: Partial<RateLimits> = {}): RateLimits {
  return {
    allowed: true,
    reachedType: null,
    primary: { usedPercent: 4, durationMins: 300, resetsAt: RESET },
    secondary: { usedPercent: 18, durationMins: 10080, resetsAt: RESET + 400_000 },
    ...overrides,
  };
}

describe("decideQuota", () => {
  it("laisse passer sous le seuil", () => {
    expect(decideQuota(limits(), 90)).toEqual({ status: "ok" });
  });

  it("bloque quand une fenêtre atteint le seuil (≥), avec pourcentages et heure de remise à zéro", () => {
    const decision = decideQuota(limits({ primary: { usedPercent: 90, durationMins: 300, resetsAt: RESET } }), 90, "UTC");
    expect(decision.status).toBe("blocked");
    if (decision.status !== "blocked") return;
    expect(decision.reason).toMatch(/^quota/);
    expect(decision.reason).toContain("seuil de 90 % atteint");
    expect(decision.reason).toContain("5 h à 90 %");
    expect(decision.reason).toContain("7 j à 18 %");
    expect(decision.reason).toContain(`remise à zéro ${formatReset(RESET, "UTC")}`);
  });

  it("bloque aussi sur la fenêtre longue", () => {
    expect(decideQuota(limits({ secondary: { usedPercent: 95, durationMins: 10080, resetsAt: RESET } }), 90).status).toBe("blocked");
  });

  it("juste sous le seuil, laisse passer", () => {
    expect(decideQuota(limits({ primary: { usedPercent: 89.9, durationMins: 300, resetsAt: RESET } }), 90).status).toBe("ok");
  });

  it("bloque quand ordinaryUsageAllowed est faux, même à 0 %", () => {
    const decision = decideQuota(limits({ allowed: false }), 90);
    expect(decision.status).toBe("blocked");
    if (decision.status === "blocked") expect(decision.reason).toContain("usage ordinaire refusé");
  });

  it("bloque quand rateLimitReachedType n'est pas nul", () => {
    const decision = decideQuota(limits({ reachedType: "primary" }), 90);
    expect(decision.status).toBe("blocked");
    if (decision.status === "blocked") expect(decision.reason).toContain("limite atteinte (primary)");
  });

  it("un seuil de 0 bloque toujours quand des pourcentages sont connus", () => {
    expect(decideQuota(limits(), 0).status).toBe("blocked");
  });

  it("des limites inconnues ne bloquent pas : la décision est « inconnu »", () => {
    expect(decideQuota(null, 90)).toEqual({ status: "unknown" });
    expect(decideQuota(null, 0)).toEqual({ status: "unknown" });
  });

  it("une fenêtre absente est ignorée", () => {
    expect(decideQuota(limits({ secondary: null }), 90).status).toBe("ok");
    expect(decideQuota(limits({ primary: null, secondary: null }), 0)).toEqual({ status: "ok" });
  });
});

describe("parseRateLimits", () => {
  const real = {
    ordinaryUsageAllowed: true,
    rateLimits: {
      primary: { usedPercent: 4, windowDurationMins: 300, resetsAt: 1791530831 },
      secondary: { usedPercent: 18, windowDurationMins: 10080, resetsAt: 1791996773 },
      planType: "plus",
      rateLimitReachedType: null,
    },
  };

  it("lit la réponse de account/rateLimits/read", () => {
    expect(parseRateLimits(real)).toEqual({
      allowed: true,
      reachedType: null,
      primary: { usedPercent: 4, durationMins: 300, resetsAt: 1791530831 },
      secondary: { usedPercent: 18, durationMins: 10080, resetsAt: 1791996773 },
    });
  });

  it("garde un rateLimitReachedType non nul", () => {
    const reached = parseRateLimits({ ...real, rateLimits: { ...real.rateLimits, rateLimitReachedType: "secondary" } });
    expect(reached?.reachedType).toBe("secondary");
  });

  it("accepte un compte sans fenêtre secondaire", () => {
    expect(parseRateLimits({ ordinaryUsageAllowed: true, rateLimits: { primary: real.rateLimits.primary } })?.secondary).toBeNull();
  });

  it.each([
    ["rien", undefined],
    ["null", null],
    ["une chaîne", "ok"],
    ["un objet vide", {}],
    ["un pourcentage texte", { ordinaryUsageAllowed: true, rateLimits: { primary: { usedPercent: "4" } } }],
    ["un pourcentage NaN", { ordinaryUsageAllowed: true, rateLimits: { primary: { usedPercent: Number.NaN } } }],
    ["une fenêtre qui n'est pas un objet", { rateLimits: { primary: 4 } }],
  ])("renvoie null (inconnu) pour %s", (_label, value) => {
    expect(parseRateLimits(value)).toBeNull();
  });
});
