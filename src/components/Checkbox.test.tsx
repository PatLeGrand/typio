import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Checkbox } from "./Checkbox";

describe("Checkbox", () => {
  it("expose une case à cocher nommée par son libellé, décochée par défaut", () => {
    render(<Checkbox label="Rester connecté" />);
    expect(screen.getByRole("checkbox", { name: "Rester connecté" })).not.toBeChecked();
  });

  it("peut être cochée par défaut", () => {
    render(<Checkbox label="Rester connecté" defaultChecked />);
    expect(screen.getByRole("checkbox", { name: "Rester connecté" })).toBeChecked();
  });

  it("cliquer sur le libellé coche la case et déclenche onChange", () => {
    const onChange = vi.fn();
    render(<Checkbox label="Rester connecté" onChange={onChange} />);
    fireEvent.click(screen.getByText("Rester connecté"));
    expect(screen.getByRole("checkbox", { name: "Rester connecté" })).toBeChecked();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("contrôlé : reflète la prop checked", () => {
    const { rerender } = render(<Checkbox label="Option" checked={false} onChange={() => {}} />);
    expect(screen.getByRole("checkbox", { name: "Option" })).not.toBeChecked();
    rerender(<Checkbox label="Option" checked onChange={() => {}} />);
    expect(screen.getByRole("checkbox", { name: "Option" })).toBeChecked();
  });

  it("désactivée : exposée comme telle, libellé grisé par le token muted", () => {
    render(<Checkbox label="Option" disabled />);
    const box = screen.getByRole("checkbox", { name: "Option" });
    expect(box).toBeDisabled();
    expect(box.closest("label")).toHaveClass("has-[:disabled]:text-muted");
  });

  it("la zone cliquable (le libellé) fait au moins 44 px de haut", () => {
    render(<Checkbox label="Option" />);
    expect(screen.getByRole("checkbox", { name: "Option" }).closest("label")).toHaveClass("min-h-11");
  });

  it("utilise la couleur d'accent du thème", () => {
    render(<Checkbox label="Option" />);
    expect(screen.getByRole("checkbox", { name: "Option" })).toHaveClass("accent-accent");
  });
});
