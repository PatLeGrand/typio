import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { OAuthProviderName } from "@/auth/oauth/providers";
import { getDictionary } from "@/i18n/dictionaries";
import { OAuthButtons } from "./OAuthButtons";

function renderButtons(locale: "fr" | "en", enabledProviders: readonly OAuthProviderName[]) {
  const { oauth } = getDictionary(locale);
  const view = render(<OAuthButtons locale={locale} labels={oauth} enabledProviders={enabledProviders} />);
  return { oauth, ...view };
}

describe("OAuthButtons: providers not configured", () => {
  it.each(["fr", "en"] as const)("GitHub et Discord sont désactivés avec la mention « bientôt » (%s)", (locale) => {
    const { oauth } = renderButtons(locale, []);

    const github = screen.getByRole("button", { name: `${oauth.github} ${oauth.soon}` });
    const discord = screen.getByRole("button", { name: `${oauth.discord} ${oauth.soon}` });
    expect(github).toBeDisabled();
    expect(discord).toBeDisabled();
    expect(screen.getAllByText(oauth.soon)).toHaveLength(2);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("les boutons ne soumettent aucun formulaire", () => {
    renderButtons("fr", []);
    for (const button of screen.getAllByRole("button")) expect(button).toHaveAttribute("type", "button");
  });

  it("chaque bouton porte son logo décoratif", () => {
    const { container } = renderButtons("en", []);
    const icons = container.querySelectorAll("svg");

    expect(icons).toHaveLength(2);
    for (const icon of icons) expect(icon).toHaveAttribute("aria-hidden", "true");
  });
});

describe("OAuthButtons: providers configured", () => {
  it.each(["fr", "en"] as const)("GitHub et Discord sont des liens actifs vers la route de départ, avec la langue (%s)", (locale) => {
    const { oauth } = renderButtons(locale, ["github", "discord"]);

    expect(screen.getByRole("link", { name: oauth.github })).toHaveAttribute("href", `/api/auth/github?locale=${locale}`);
    expect(screen.getByRole("link", { name: oauth.discord })).toHaveAttribute("href", `/api/auth/discord?locale=${locale}`);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.queryByText(oauth.soon)).toBeNull();
  });

  it("utilise un lien natif : pas de préchargement ni de navigation côté client vers une route à cookies", () => {
    renderButtons("fr", ["github"]);
    const link = screen.getByRole("link", { name: "GitHub" });

    expect(link.tagName).toBe("A");
    expect(link).not.toHaveAttribute("data-nextjs-link");
    expect(link).not.toHaveAttribute("target");
  });

  it("n'active que les fournisseurs configurés", () => {
    const { oauth } = renderButtons("fr", ["discord"]);

    expect(screen.getByRole("link", { name: oauth.discord })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: `${oauth.github} ${oauth.soon}` })).toBeDisabled();
    expect(screen.getAllByText(oauth.soon)).toHaveLength(1);
  });

  it("garde le logo, le nom et la même apparence de bouton que la version désactivée", () => {
    const { container } = renderButtons("fr", ["github", "discord"]);

    expect(container.querySelectorAll("a svg")).toHaveLength(2);
    for (const link of screen.getAllByRole("link")) {
      expect(link.className).toContain("rounded-field");
      expect(link.className).toContain("border");
      // Le survol doit s'appliquer à un lien (`:enabled` ne vise que les éléments de formulaire).
      expect(link.className).toContain("not-disabled:hover:bg-accent-soft");
      expect(link.className).not.toContain("enabled:hover:");
    }
  });
});

describe("OAuthButtons: structure", () => {
  it("regroupe les boutons sous un nom accessible traduit", () => {
    const { oauth } = renderButtons("en", []);

    expect(screen.getByRole("group", { name: oauth.groupLabel })).toBeInTheDocument();
  });

  it.each([
    ["fr", "Discord et GitHub sont réservés aux 13 ans et plus."],
    ["en", "Discord and GitHub are for ages 13 and over."],
  ] as const)("affiche la mention des 13 ans sous les boutons, actifs ou non (%s)", (locale, text) => {
    for (const enabled of [[], ["github", "discord"]] as const) {
      const { unmount, oauth } = renderButtons(locale, enabled);
      const note = screen.getByText(text);

      expect(oauth.ageNote).toBe(text);
      const group = screen.getByRole("group", { name: oauth.groupLabel });
      expect(group.compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      unmount();
    }
  });
});
