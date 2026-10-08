import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SelectField } from "./SelectField";

const options = [
  { value: "fr", label: "Français" },
  { value: "en", label: "Anglais" },
];

describe("SelectField", () => {
  it("relie le libellé à la liste (nom accessible) et affiche chaque option", () => {
    render(<SelectField label="Langue" options={options} defaultValue="en" />);
    const select = screen.getByRole("combobox", { name: "Langue" });
    expect(select).toHaveValue("en");
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["Français", "Anglais"]);
  });

  it("respecte l'id fourni", () => {
    render(<SelectField label="Langue" options={options} id="langue" />);
    expect(screen.getByRole("combobox", { name: "Langue" })).toHaveAttribute("id", "langue");
  });

  it("signale le changement de valeur", () => {
    const onChange = vi.fn();
    render(<SelectField label="Langue" options={options} value="fr" onChange={onChange} />);
    fireEvent.change(screen.getByRole("combobox", { name: "Langue" }), { target: { value: "en" } });
    expect(onChange).toHaveBeenCalledOnce();
  });

  it("peut être désactivée", () => {
    render(<SelectField label="Langue" options={options} disabled />);
    expect(screen.getByRole("combobox", { name: "Langue" })).toBeDisabled();
  });
});
