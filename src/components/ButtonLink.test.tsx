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

  it("variante key : conserve le relief sur un lien", () => {
    render(<ButtonLink href="/fr/register" variant="key">Créer un compte</ButtonLink>);
    expect(screen.getByRole("link", { name: "Créer un compte" })).toHaveClass(
      "bg-key-yellow", "text-key-ink", "min-h-11",
      "not-disabled:shadow-[0_4px_0_var(--key-shadow)]",
      "not-disabled:active:translate-y-[3px]",
    );
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

  it.each(["key", "secondary", "ghost"] as const)("%s : le décor est aria-hidden et absent si aria-disabled", (variant) => {
    const { rerender } = render(<ButtonLink href="/fr" variant={variant}>Go</ButtonLink>);
    const link = screen.getByRole("link", { name: "Go" });
    expect(link.querySelector(".button-blobs, .button-road")).toHaveAttribute("aria-hidden", "true");
    rerender(<ButtonLink href="/fr" variant={variant} aria-disabled>Go</ButtonLink>);
    expect(screen.getByRole("link", { name: "Go" })).toHaveAttribute("href", "/fr");
    expect(link.querySelector(".button-blobs, .button-road")).toBeNull();
  });

  it("accepte une grande touche sans perdre les classes, la largeur ni le libellé", () => {
    render(<ButtonLink href="/fr" variant="key" size="large" fullWidth className="md:rounded-full">Go</ButtonLink>);
    expect(screen.getByRole("link", { name: "Go" })).toHaveClass("min-h-14", "py-3", "text-base", "w-full", "md:rounded-full");
  });
});

it("réduit seulement les liens compacts sur mobile sans couper le libellé", () => {
  const { rerender } = render(<ButtonLink href="/fr/login" compactOnMobile>Se connecter</ButtonLink>);
  expect(screen.getByRole("link")).toHaveClass("whitespace-nowrap", "px-4", "md:px-6");
  expect(screen.getByRole("link")).not.toHaveClass("px-6");
  rerender(<ButtonLink href="/fr/login">Se connecter</ButtonLink>);
  expect(screen.getByRole("link")).toHaveClass("px-6");
  expect(screen.getByRole("link")).not.toHaveClass("px-4");
});
