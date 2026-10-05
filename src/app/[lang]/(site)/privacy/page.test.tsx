import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { getDictionary } from "@/i18n/dictionaries";
import PrivacyPage, { generateMetadata } from "./page";

function props(lang: string) {
  return { params: Promise.resolve({ lang }), searchParams: Promise.resolve({}) };
}

describe("PrivacyPage", () => {
  it.each(["fr", "en"] as const)("affiche titre, sections et chaque mention traduits (%s)", async (lang) => {
    const { privacy } = getDictionary(lang);
    render(await PrivacyPage(props(lang)));

    expect(screen.getByRole("heading", { level: 1, name: privacy.title })).toBeInTheDocument();
    for (const title of [privacy.storedTitle, privacy.cookiesTitle, privacy.guestsTitle, privacy.neverTitle]) {
      expect(screen.getByRole("heading", { level: 2, name: title })).toBeInTheDocument();
    }
    for (const text of [
      ...Object.values(privacy.stored),
      ...Object.values(privacy.cookies),
      privacy.guests,
      ...Object.values(privacy.never),
    ]) {
      expect(screen.getByText(text)).toBeInTheDocument();
    }
  });

  it("dit honnêtement ce qui est stocké et ce qui ne l'est pas (FR)", () => {
    const { privacy } = getDictionary("fr");
    expect(privacy.stored.password).toMatch(/argon2id/);
    expect(privacy.stored.password).toMatch(/jamais .* en clair/);
    expect(privacy.cookies.duration).toMatch(/30 jours/);
    expect(privacy.guests).toMatch(/24 h/);
    expect(privacy.never.email).toMatch(/e-mail/);
    expect(privacy.never.tracking).toMatch(/publicité/);
    expect(privacy.never.resale).toMatch(/revendues/);
  });

  it("dit honnêtement ce qui est stocké et ce qui ne l'est pas (EN)", () => {
    const { privacy } = getDictionary("en");
    expect(privacy.stored.password).toMatch(/argon2id/);
    expect(privacy.stored.password).toMatch(/never stored in plain text/);
    expect(privacy.cookies.duration).toMatch(/30 days/);
    expect(privacy.guests).toMatch(/24 hours/);
    expect(privacy.never.email).toMatch(/email/);
    expect(privacy.never.tracking).toMatch(/no ads/);
    expect(privacy.never.resale).toMatch(/never sold/);
  });

  it.each(["fr", "en"] as const)("métadonnées traduites (%s)", async (lang) => {
    const { meta } = getDictionary(lang).privacy;
    const metadata = await generateMetadata(props(lang) as Parameters<typeof generateMetadata>[0]);
    expect(metadata).toEqual({ title: meta.title, description: meta.description });
  });

  it("répond par une 404 pour une locale inconnue", async () => {
    await expect(PrivacyPage(props("de"))).rejects.toMatchObject({ digest: expect.stringContaining("404") });
  });
});
