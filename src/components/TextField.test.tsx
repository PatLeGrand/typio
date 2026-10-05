import { fireEvent, render, screen } from "@testing-library/react";
import { User } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { TextField } from "./TextField";

describe("TextField", () => {
  it("relie le libellé au champ (nom accessible) avec un id généré", () => {
    render(<TextField label="Identifiant" />);
    const input = screen.getByRole("textbox", { name: "Identifiant" });
    expect(input).toHaveAttribute("id");
    expect(input).toHaveAttribute("type", "text");
  });

  it("respecte l'id fourni", () => {
    render(<TextField label="Pseudo" id="pseudo" />);
    expect(screen.getByRole("textbox", { name: "Pseudo" })).toHaveAttribute("id", "pseudo");
  });

  it("sans erreur : ni aria-invalid ni aria-describedby ni message", () => {
    render(<TextField label="Pseudo" />);
    const input = screen.getByRole("textbox", { name: "Pseudo" });
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(input).not.toHaveAttribute("aria-describedby");
    expect(input).toHaveClass("border-border");
  });

  it("avec erreur : champ invalide, message relié par aria-describedby", () => {
    render(<TextField label="Pseudo" error="Pseudo trop court" />);
    const input = screen.getByRole("textbox", { name: "Pseudo" });
    expect(input).toBeInvalid();
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Pseudo trop court");
    expect(input).toHaveClass("border-danger");
  });

  it("conserve un aria-describedby fourni en plus de l'erreur", () => {
    render(
      <>
        <p id="aide">Entre 3 et 20 caractères</p>
        <TextField label="Pseudo" aria-describedby="aide" error="Trop court" />
      </>,
    );
    expect(screen.getByRole("textbox", { name: "Pseudo" })).toHaveAccessibleDescription("Entre 3 et 20 caractères Trop court");
  });

  it("affiche l'élément icône dans un conteneur décoratif de 20 px, et réserve sa place", () => {
    const { container } = render(<TextField label="Pseudo" icon={<User />} />);
    const svg = container.querySelector("svg");
    expect(svg?.parentElement).toHaveAttribute("aria-hidden", "true");
    expect(svg?.parentElement).toHaveClass("size-5", "text-muted");
    expect(screen.getByRole("textbox", { name: "Pseudo" })).toHaveClass("pl-12");
  });

  it("sans icône : pas de conteneur d'icône", () => {
    const { container } = render(<TextField label="Pseudo" />);
    expect(container.querySelector("[aria-hidden]")).toBeNull();
    expect(screen.getByRole("textbox", { name: "Pseudo" })).toHaveClass("pl-4");
  });

  it("affiche le slot de droite et réserve sa place", () => {
    render(<TextField label="Pseudo" endSlot={<button type="button">Aide</button>} />);
    expect(screen.getByRole("button", { name: "Aide" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Pseudo" })).toHaveClass("pr-14");
  });

  it("transmet les attributs natifs et les événements", () => {
    const onChange = vi.fn();
    render(<TextField label="Pseudo" placeholder="abc" required onChange={onChange} />);
    const input = screen.getByRole("textbox", { name: "Pseudo" });
    expect(input).toBeRequired();
    expect(input).toHaveAttribute("placeholder", "abc");
    fireEvent.change(input, { target: { value: "x" } });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("désactivé : le champ est désactivé", () => {
    render(<TextField label="Pseudo" disabled />);
    expect(screen.getByRole("textbox", { name: "Pseudo" })).toBeDisabled();
  });
});
