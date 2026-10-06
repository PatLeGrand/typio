import { render, screen } from "@testing-library/react";
import { UserRound } from "lucide-react";
import { describe, expect, it } from "vitest";
import { ButtonLink } from "./ButtonLink";

describe("ButtonLink", () => {
  it("est un lien accessible vers la cible, pas un bouton", () => {
    render(<ButtonLink href="/fr/guest">Jouer en invité</ButtonLink>);

    expect(screen.getByRole("link", { name: "Jouer en invité" })).toHaveAttribute("href", "/fr/guest");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("reprend les classes du bouton secondaire et la pleine largeur", () => {
    render(
      <ButtonLink href="/fr/guest" variant="secondary" fullWidth>
        Go
      </ButtonLink>,
    );

    expect(screen.getByRole("link", { name: "Go" })).toHaveClass(
      "rounded-field",
      "min-h-13",
      "border-border",
      "bg-surface",
      "w-full",
    );
  });

  it("le survol s'applique au lien (not-disabled:hover:, pas enabled:hover:)", () => {
    render(
      <ButtonLink href="/fr/guest" variant="secondary">
        Go
      </ButtonLink>,
    );

    const link = screen.getByRole("link", { name: "Go" });
    expect(link).toHaveClass("not-disabled:hover:bg-accent-soft");
    expect(link.className).not.toContain("enabled:hover:");
  });

  it("primaire par défaut", () => {
    render(<ButtonLink href="/fr">Go</ButtonLink>);
    expect(screen.getByRole("link", { name: "Go" })).toHaveClass("bg-accent", "min-h-14");
  });

  it("garde le nom accessible du texte quand une icône décorative précède le libellé", () => {
    render(
      <ButtonLink href="/fr/guest" variant="secondary">
        <UserRound aria-hidden="true" />
        Jouer en invité
      </ButtonLink>,
    );

    expect(screen.getByRole("link", { name: "Jouer en invité" })).toBeInTheDocument();
  });
});
