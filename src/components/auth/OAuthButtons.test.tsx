import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { getDictionary } from "@/i18n/dictionaries";
import { OAuthButtons } from "./OAuthButtons";

describe("OAuthButtons", () => {
  it.each(["fr", "en"] as const)("GitHub et Discord sont désactivés avec la mention « bientôt » (%s)", (locale) => {
    const { oauth } = getDictionary(locale);
    render(<OAuthButtons labels={oauth} />);

    const github = screen.getByRole("button", { name: `${oauth.github} ${oauth.soon}` });
    const discord = screen.getByRole("button", { name: `${oauth.discord} ${oauth.soon}` });
    expect(github).toBeDisabled();
    expect(discord).toBeDisabled();
    expect(screen.getAllByText(oauth.soon)).toHaveLength(2);
  });

  it("les boutons ne soumettent aucun formulaire", () => {
    render(<OAuthButtons labels={getDictionary("fr").oauth} />);
    for (const button of screen.getAllByRole("button")) expect(button).toHaveAttribute("type", "button");
  });

  it("regroupe les boutons sous un nom accessible traduit, et l'icône GitHub est décorative", () => {
    const { oauth } = getDictionary("en");
    const { container } = render(<OAuthButtons labels={oauth} />);

    expect(screen.getByRole("group", { name: oauth.groupLabel })).toBeInTheDocument();
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});
