import { fireEvent, render, screen } from "@testing-library/react";
import { Lock } from "lucide-react";
import { describe, expect, it } from "vitest";
import { PasswordField } from "./PasswordField";

function renderField(props: Partial<React.ComponentProps<typeof PasswordField>> = {}) {
  return render(<PasswordField label="Mot de passe" showLabel="Afficher le mot de passe" hideLabel="Masquer le mot de passe" {...props} />);
}

describe("PasswordField", () => {
  it("masque la saisie par défaut, avec un bouton « afficher »", () => {
    const { container } = renderField();
    const input = container.querySelector("input");
    expect(input).toHaveAttribute("type", "password");
    expect(screen.getByLabelText("Mot de passe")).toBe(input);
    expect(screen.getByRole("button", { name: "Afficher le mot de passe" })).toHaveAttribute("type", "button");
  });

  it("le bouton œil bascule entre affichage et masquage, et change de nom accessible", () => {
    const { container } = renderField();
    const input = container.querySelector("input");

    fireEvent.click(screen.getByRole("button", { name: "Afficher le mot de passe" }));
    expect(input).toHaveAttribute("type", "text");
    expect(screen.queryByRole("button", { name: "Afficher le mot de passe" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Masquer le mot de passe" }));
    expect(input).toHaveAttribute("type", "password");
  });

  it("la bascule conserve la valeur saisie", () => {
    renderField();
    const input = screen.getByLabelText("Mot de passe");
    fireEvent.change(input, { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Afficher le mot de passe" }));
    expect(input).toHaveValue("secret");
  });

  it("l'icône de l'œil est décorative et le bouton fait 44 px", () => {
    renderField();
    const button = screen.getByRole("button", { name: "Afficher le mot de passe" });
    expect(button.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(button).toHaveClass("size-11");
  });

  it("accepte une icône passée comme élément (compatible Server Component)", () => {
    const { container } = renderField({ icon: <Lock data-testid="lock" /> });
    const lock = screen.getByTestId("lock");
    expect(lock.parentElement).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelectorAll("svg")).toHaveLength(2); // cadenas + œil
    expect(screen.getByLabelText("Mot de passe")).toHaveClass("pl-12");
  });

  it("affiche l'erreur reliée au champ", () => {
    renderField({ error: "Mot de passe incorrect" });
    const input = screen.getByLabelText("Mot de passe");
    expect(input).toBeInvalid();
    expect(input).toHaveAccessibleDescription("Mot de passe incorrect");
  });
});
