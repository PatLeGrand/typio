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

  it("variante key : touche jaune compacte", () => {
    render(<Button variant="key">Entrée</Button>);
    expect(screen.getByRole("button", { name: "Entrée" })).toHaveClass("bg-key-yellow", "text-key-ink", "min-h-11", "py-2", "text-sm", "font-bold");
  });

  it("hauteurs minimales (jamais fixes) pour ne pas couper un libellé long", () => {
    render(
      <>
        <Button>Primaire</Button>
        <Button variant="secondary">Secondaire</Button>
        <Button variant="ghost">Discret</Button>
        <Button variant="key">Entrée</Button>
      </>,
    );
    for (const name of ["Primaire", "Secondaire", "Discret", "Entrée"]) {
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

  it.each(["key", "secondary", "ghost"] as const)("%s : le décor reste masqué aux lecteurs d'écran et disparaît si désactivé", (variant) => {
    const { rerender } = render(<Button variant={variant}>Go</Button>);
    const button = screen.getByRole("button", { name: "Go" });
    expect(button.querySelector(".button-blobs, .button-road, .button-start-decor")).toHaveAttribute("aria-hidden", "true");
    rerender(<Button variant={variant} disabled>Go</Button>);
    expect(screen.getByRole("button", { name: "Go" })).toBeDisabled();
    expect(button.querySelector(".button-blobs, .button-road, .button-start-decor")).toBeNull();
    rerender(<Button variant={variant} aria-disabled="true">Go</Button>);
    expect(button.querySelector(".button-blobs, .button-road, .button-start-decor")).toBeNull();
    rerender(<Button variant={variant} aria-disabled>Go</Button>);
    expect(button.querySelector(".button-blobs, .button-road, .button-start-decor")).toBeNull();
  });

  it.each([{ disabled: true }, { "aria-disabled": "true" }, { "aria-disabled": true }] as const)("start : conserve le décor aria-hidden si désactivé (%j)", (props) => {
    render(<Button variant="start" {...props}>Go</Button>);
    const button = screen.getByRole("button", { name: "Go" });
    expect(button.querySelector(".button-start-decor")).toHaveAttribute("aria-hidden", "true");
    expect(button.querySelectorAll(".button-start-light")).toHaveLength(3);
    expect(button.querySelector(".button-start-arrow svg")).toBeInTheDocument();
    expect(button).toHaveAccessibleName("Go");
  });

  it.each(["Créer une course", "Create a race", "Rejouer", "Play again"])("start : trois feux et une flèche gardent le nom accessible « %s »", (label) => {
    render(<Button variant="start">{label}</Button>);
    const button = screen.getByRole("button", { name: label });
    expect(button).toHaveAccessibleName(label);
    expect(button.querySelectorAll(".button-start-light")).toHaveLength(3);
    expect(button.querySelectorAll(".button-start-arrow svg")).toHaveLength(1);
  });

  it("la détection du côté laisse le clic remonter au bouton", () => {
    const onClick = vi.fn();
    render(<Button variant="key" onClick={onClick}>Go</Button>);
    const button = screen.getByRole("button", { name: "Go" });
    for (const side of button.querySelectorAll("[data-side]")) fireEvent.click(side);
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it("la grande touche garde la pleine largeur et le libellé", () => {
    render(<Button variant="key" size="large" fullWidth>Go</Button>);
    expect(screen.getByRole("button", { name: "Go" })).toHaveClass("min-h-14", "py-3", "text-base", "w-full");
  });
});
