import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Card } from "./Card";

describe("Card", () => {
  it("affiche son contenu sur la surface du thème, arrondie et ombrée", () => {
    render(<Card data-testid="card">Contenu</Card>);
    const card = screen.getByTestId("card");
    expect(card).toHaveTextContent("Contenu");
    expect(card).toHaveClass("bg-surface", "rounded-card", "shadow-soft");
  });

  it("conserve la classe fournie par l'appelant", () => {
    render(
      <Card data-testid="card" className="p-6">
        x
      </Card>,
    );
    expect(screen.getByTestId("card")).toHaveClass("p-6", "bg-surface");
  });
});
