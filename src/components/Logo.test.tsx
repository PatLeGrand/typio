import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Logo } from "./Logo";

describe("Logo", () => {
  it("affiche le nom du produit et une touche dont l'icône est décorative", () => {
    const { container } = render(<Logo name="Typio" />);
    expect(screen.getByText("Typio")).toHaveClass("font-extrabold");
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg?.parentElement).toHaveClass("bg-accent", "text-accent-foreground");
  });

  it("n'affiche pas de signature par défaut", () => {
    const { container } = render(<Logo name="Typio" />);
    expect(container.querySelector(".border-l")).toBeNull();
  });

  it("affiche la signature fournie après un séparateur", () => {
    render(<Logo name="Typio" tagline="Petit à petit" />);
    expect(screen.getByText("Petit à petit")).toHaveClass("border-l", "border-border");
  });
});
