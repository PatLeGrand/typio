import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AuthAltLink } from "./AuthAltLink";
import { AuthDivider } from "./AuthDivider";
import { AuthHeading } from "./AuthHeading";
import { AuthInfoNote } from "./AuthInfoNote";
import { AuthSubmitButton } from "./AuthSubmitButton";
import { FormAlert } from "./FormAlert";

describe("AuthSubmitButton", () => {
  it("a le libellé pour nom accessible : la pastille « Entrée » est décorative", () => {
    const { container } = render(<AuthSubmitButton label="Se connecter" enterKeyLabel="Entrée" pending={false} />);

    const button = screen.getByRole("button", { name: "Se connecter" });
    expect(button).toHaveAttribute("type", "submit");
    expect(button).toBeEnabled();
    const pill = container.querySelector('[aria-hidden="true"]');
    expect(pill).toHaveTextContent("Entrée");
    expect(pill?.querySelector("svg")).not.toBeNull();
  });

  it("pendant l'envoi : désactivé et marqué occupé", () => {
    render(<AuthSubmitButton label="Se connecter" enterKeyLabel="Entrée" pending />);

    const button = screen.getByRole("button", { name: "Se connecter" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });
});

describe("AuthDivider", () => {
  it("affiche le texte entre deux filets décoratifs", () => {
    const { container } = render(<AuthDivider>ou avec ton identifiant</AuthDivider>);

    expect(screen.getByText("ou avec ton identifiant")).toBeInTheDocument();
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(2);
  });
});

describe("AuthHeading", () => {
  it("rend le badge, le titre en h1 et l'introduction", () => {
    render(<AuthHeading kicker="À tes touches" title="Content de te revoir !" intro="Connecte-toi." />);

    expect(screen.getByText("À tes touches")).toHaveClass("uppercase");
    expect(screen.getByRole("heading", { level: 1, name: "Content de te revoir !" })).toBeInTheDocument();
    expect(screen.getByText("Connecte-toi.")).toBeInTheDocument();
  });
});

describe("AuthAltLink", () => {
  it("affiche la question et un lien vers la cible", () => {
    render(<AuthAltLink prompt="Déjà un compte ?" linkLabel="Connecte-toi" href="/fr/login" />);

    expect(screen.getByText(/Déjà un compte/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Connecte-toi" })).toHaveAttribute("href", "/fr/login");
  });
});

describe("AuthInfoNote", () => {
  it("affiche le texte avec une icône décorative", () => {
    const { container } = render(<AuthInfoNote>Déconnecte-toi à la fin.</AuthInfoNote>);

    expect(screen.getByText("Déconnecte-toi à la fin.")).toBeInTheDocument();
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});

describe("FormAlert", () => {
  it("est annoncée comme alerte", () => {
    render(<FormAlert>Identifiant ou mot de passe incorrect.</FormAlert>);
    expect(screen.getByRole("alert")).toHaveTextContent("Identifiant ou mot de passe incorrect.");
  });
});
