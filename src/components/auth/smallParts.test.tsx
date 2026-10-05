import { fireEvent, render, screen } from "@testing-library/react";
import type { FormEvent } from "react";
import { describe, expect, it, vi } from "vitest";
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

  it("pendant l'envoi : aria-disabled et occupé, mais pas `disabled` (le focus est gardé)", () => {
    render(<AuthSubmitButton label="Se connecter" enterKeyLabel="Entrée" pending />);

    const button = screen.getByRole("button", { name: "Se connecter" });
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).not.toHaveAttribute("disabled");
    button.focus();
    expect(button).toHaveFocus();
  });

  it("hors envoi : ni aria-disabled ni aria-busy", () => {
    render(<AuthSubmitButton label="Se connecter" enterKeyLabel="Entrée" pending={false} />);

    const button = screen.getByRole("button", { name: "Se connecter" });
    expect(button).not.toHaveAttribute("aria-disabled");
    expect(button).not.toHaveAttribute("aria-busy");
  });

  it("ignore un second envoi pendant l'envoi, et laisse passer le premier", () => {
    const onSubmit = vi.fn((event: FormEvent) => event.preventDefault());
    const { rerender } = render(
      <form onSubmit={onSubmit}>
        <AuthSubmitButton label="Se connecter" enterKeyLabel="Entrée" pending={false} />
      </form>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Se connecter" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);

    rerender(
      <form onSubmit={onSubmit}>
        <AuthSubmitButton label="Se connecter" enterKeyLabel="Entrée" pending />
      </form>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Se connecter" }));
    fireEvent.click(screen.getByRole("button", { name: "Se connecter" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
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
