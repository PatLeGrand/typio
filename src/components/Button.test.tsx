import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./Button";

describe("Button", () => {
  it("est de type « button » par défaut (ne soumet pas un formulaire)", () => {
    render(<Button>Go</Button>);
    expect(screen.getByRole("button", { name: "Go" })).toHaveAttribute("type", "button");
  });

  it("accepte un type explicite", () => {
    render(<Button type="submit">Go</Button>);
    expect(screen.getByRole("button", { name: "Go" })).toHaveAttribute("type", "submit");
  });

  it("déclenche onClick quand il est actif", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Go</Button>);
    fireEvent.click(screen.getByRole("button", { name: "Go" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("désactivé : expose l'état et ne déclenche pas onClick", () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Go
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Go" });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("applique la variante et conserve la classe fournie", () => {
    render(
      <Button variant="secondary" className="w-full">
        Go
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Go" });
    expect(button).toHaveClass("border-border", "bg-surface", "w-full");
    expect(button).not.toHaveClass("bg-accent");
  });

  it("primaire par défaut : fond d'accent", () => {
    render(<Button>Go</Button>);
    expect(screen.getByRole("button", { name: "Go" })).toHaveClass("bg-accent", "text-accent-foreground", "min-h-14");
  });

  it("variante ghost : sans fond ni bordure", () => {
    render(<Button variant="ghost">Go</Button>);
    const button = screen.getByRole("button", { name: "Go" });
    expect(button).toHaveClass("text-accent-text");
    expect(button).not.toHaveClass("bg-accent", "border");
  });

  it("hauteurs minimales (jamais fixes) pour ne pas couper un libellé long", () => {
    render(
      <>
        <Button>Primaire</Button>
        <Button variant="secondary">Secondaire</Button>
        <Button variant="ghost">Discret</Button>
      </>,
    );
    for (const name of ["Primaire", "Secondaire", "Discret"]) {
      const classes = screen.getByRole("button", { name }).className.split(" ");
      expect(classes.some((c) => c.startsWith("min-h-"))).toBe(true);
      expect(classes.some((c) => /^h-\d/.test(c))).toBe(false);
    }
  });

  it("fullWidth occupe toute la largeur, sinon non", () => {
    const { rerender } = render(<Button>Go</Button>);
    expect(screen.getByRole("button", { name: "Go" })).not.toHaveClass("w-full");
    rerender(<Button fullWidth>Go</Button>);
    expect(screen.getByRole("button", { name: "Go" })).toHaveClass("w-full");
  });

  it("désactivé : utilise des couleurs lisibles plutôt qu'une simple opacité", () => {
    render(<Button disabled>Go</Button>);
    expect(screen.getByRole("button", { name: "Go" })).toHaveClass("disabled:bg-accent-panel", "disabled:text-muted-strong");
  });
});
