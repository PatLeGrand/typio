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
    for (const title of [
      privacy.storedTitle,
      privacy.cookiesTitle,
      privacy.guestsTitle,
      privacy.securityTitle,
      privacy.neverTitle,
    ]) {
      expect(screen.getByRole("heading", { level: 2, name: title })).toBeInTheDocument();
    }
    for (const text of [
      ...Object.values(privacy.stored),
      ...Object.values(privacy.cookies),
      privacy.guests,
      ...Object.values(privacy.security),
      ...Object.values(privacy.never),
    ]) {
      expect(screen.getByText(text)).toBeInTheDocument();
    }
  });

  it("dit exactement ce qui est stocké lors d'une connexion GitHub ou Discord (FR)", () => {
    const { privacy } = getDictionary("fr");
    expect(privacy.stored.oauth).toMatch(/GitHub ou Discord/);
    expect(privacy.stored.oauth).toMatch(/seulement l'identifiant numérique/);
    expect(privacy.stored.oauth).toMatch(/sert une seule fois, à créer ton pseudo/);
    expect(privacy.stored.oauth).toMatch(/adresse e-mail, ta photo/);
    expect(privacy.stored.oauth).toMatch(/jetons d'accès/);
    expect(privacy.cookies.duration).toMatch(/avec GitHub ou Discord, c'est un cookie de session/);
    expect(privacy.cookies.oauth).toMatch(/GitHub ou Discord/);
    expect(privacy.cookies.oauth).toMatch(/10 minutes/);
    expect(privacy.cookies.oauth).toMatch(/effacés dès ton retour/);
  });

  it("dit exactement ce qui est stocké lors d'une connexion GitHub ou Discord (EN)", () => {
    const { privacy } = getDictionary("en");
    expect(privacy.stored.oauth).toMatch(/GitHub or Discord/);
    expect(privacy.stored.oauth).toMatch(/only the numeric ID/);
    expect(privacy.stored.oauth).toMatch(/used once, to create your username/);
    expect(privacy.stored.oauth).toMatch(/email address, your picture/);
    expect(privacy.stored.oauth).toMatch(/access tokens/);
    expect(privacy.cookies.duration).toMatch(/with GitHub or Discord, it is a session cookie/);
    expect(privacy.cookies.oauth).toMatch(/GitHub or Discord/);
    expect(privacy.cookies.oauth).toMatch(/10 minutes/);
    expect(privacy.cookies.oauth).toMatch(/deleted as soon as you come back/);
  });

  it("dit ce que le code fait vraiment (FR)", () => {
    const { privacy } = getDictionary("fr");
    expect(privacy.stored.password).toMatch(/argon2id/);
    expect(privacy.stored.password).toMatch(/jamais .* en clair/);
    expect(privacy.cookies.session).toMatch(/seulement un jeton aléatoire/);
    expect(privacy.cookies.session).toMatch(/restent sur le serveur/);
    expect(privacy.cookies.duration).toMatch(/30 jours/);
    expect(privacy.cookies.duration).toMatch(/au plus tard après 24 h, même si ton navigateur la restaure/);
    expect(privacy.guests).toMatch(/quand il se déconnecte/);
    expect(privacy.guests).toMatch(/nettoyage automatique qui suit l'expiration de 24 h/);
    expect(privacy.security.ip).toMatch(/au plus 1 h/);
    expect(privacy.security.ip).toMatch(/jamais enregistrée en base/);
    expect(privacy.never.email).toMatch(/e-mail/);
    expect(privacy.never.tracking).toMatch(/publicité/);
    expect(privacy.never.resale).toMatch(/revendues/);
  });

  it("dit ce que le code fait vraiment (EN)", () => {
    const { privacy } = getDictionary("en");
    expect(privacy.stored.password).toMatch(/argon2id/);
    expect(privacy.stored.password).toMatch(/never stored in plain text/);
    expect(privacy.cookies.session).toMatch(/only holds a random token/);
    expect(privacy.cookies.session).toMatch(/stay on the server/);
    expect(privacy.cookies.duration).toMatch(/30 days/);
    expect(privacy.cookies.duration).toMatch(/24 hours at most, even if your browser restores it/);
    expect(privacy.guests).toMatch(/when they sign out/);
    expect(privacy.guests).toMatch(/cleanup that follows the 24-hour expiry/);
    expect(privacy.security.ip).toMatch(/1 hour at most/);
    expect(privacy.security.ip).toMatch(/never saved in the database/);
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
