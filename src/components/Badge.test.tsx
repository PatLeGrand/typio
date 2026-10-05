import { render, screen } from "@testing-library/react";
import { Sparkles } from "lucide-react";
import { describe, expect, it } from "vitest";
import { Badge } from "./Badge";

describe("Badge", () => {
  it("affiche son texte dans une pastille aux couleurs d'accent", () => {
    render(<Badge>Nouveau</Badge>);
    const badge = screen.getByText("Nouveau");
    expect(badge).toHaveClass("rounded-full", "bg-accent-soft", "text-accent-text", "uppercase");
  });

  it("sans icône : aucun svg", () => {
    const { container } = render(<Badge>Nouveau</Badge>);
    expect(container.querySelector("svg")).toBeNull();
  });

  it("avec icône (élément) : conteneur décoratif de 14 px, le nom accessible reste le texte", () => {
    const { container } = render(<Badge icon={<Sparkles />}>Nouveau</Badge>);
    const svg = container.querySelector("svg");
    expect(svg?.parentElement).toHaveAttribute("aria-hidden", "true");
    expect(svg?.parentElement).toHaveClass("size-3.5");
    expect(screen.getByText("Nouveau")).toHaveTextContent("Nouveau");
  });

  it("transmet les attributs natifs (ex. lang)", () => {
    render(<Badge lang="en">New</Badge>);
    expect(screen.getByText("New")).toHaveAttribute("lang", "en");
  });
});
