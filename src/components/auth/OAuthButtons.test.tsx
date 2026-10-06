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
  });
});
