import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/auth/types";
import { getDictionary } from "@/i18n/dictionaries";
import type { ProfileUpdateResult } from "@/profile/profileSettings";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  updateProfile: vi.fn<(formData: FormData) => Promise<ProfileUpdateResult>>(),
  logout: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("./actions", () => ({ updateProfile: mocks.updateProfile }));
vi.mock("@/auth/actions", () => ({ logout: mocks.logout }));

import { ProfileForm } from "./ProfileForm";

const member: CurrentUser = {
  id: "11111111-1111-1111-1111-111111111111",
  kind: "member",
  displayName: "Alice",
  username: "alice",
  locale: "fr",
};
const guest: CurrentUser = { ...member, kind: "guest", displayName: "Zoé", username: null };

function renderForm(locale: "fr" | "en", user: CurrentUser = member) {
  const dictionary = getDictionary(locale);
  render(
    <ProfileForm
      user={user}
      dbUser={{ createdAt: new Date("2026-01-15T12:00:00Z"), keyboardLayout: "qwerty" }}
      hasPassword
      hasGithub={false}
      hasDiscord
      dictionary={dictionary}
      locale={locale}
    />,
  );
  return dictionary;
}

function nameField(dictionary: ReturnType<typeof getDictionary>) {
  return screen.getByRole<HTMLInputElement>("textbox", { name: dictionary.profile.identity.displayName });
}

function saveButton(dictionary: ReturnType<typeof getDictionary>) {
  return screen.getByRole("button", { name: dictionary.profile.actions.save });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.updateProfile.mockResolvedValue({ ok: true, locale: "fr" });
});

describe.each(["fr", "en"] as const)("ProfileForm (%s)", (locale) => {
  it("affiche les libellés traduits, dont la disposition « Canadien multilingue »", () => {
    const dictionary = renderForm(locale);
    const { profile } = dictionary;

    expect(screen.getByRole("textbox", { name: profile.identity.displayName })).toHaveValue("Alice");
    expect(screen.getByRole("textbox", { name: profile.identity.username })).toHaveValue("@alice");
    expect(screen.getByRole("radio", { name: profile.settings.layouts.cmf })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: profile.settings.layouts.qwerty })).toBeChecked();
    expect(screen.getByRole("radio", { name: dictionary.language.names[locale] })).toBeChecked();
    expect(screen.getByRole("group", { name: profile.settings.layout })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: profile.settings.language })).toBeInTheDocument();
    expect(screen.getByText(profile.identity.member)).toBeInTheDocument();
    expect(screen.getByText(profile.actions.noChanges)).toBeInTheDocument();
    expect(saveButton(dictionary)).toBeDisabled();
  });

  it("envoie la disposition cmf (valeur de la base) et rien d'autre que les trois réglages", async () => {
    const dictionary = renderForm(locale);

    fireEvent.click(screen.getByRole("radio", { name: dictionary.profile.settings.layouts.cmf }));
    await act(async () => {
      fireEvent.submit(nameField(dictionary).closest("form") as HTMLFormElement);
    });

    expect(mocks.updateProfile).toHaveBeenCalledTimes(1);
    const sent = mocks.updateProfile.mock.calls[0][0];
    expect(Object.fromEntries(sent.entries())).toEqual({ displayName: "Alice", keyboardLayout: "cmf", locale });
    expect(await screen.findByText(dictionary.profile.status.saved)).toBeInTheDocument();
  });

  it("un choix exclusif remplace le précédent (un seul radio coché par groupe)", () => {
    const dictionary = renderForm(locale);

    fireEvent.click(screen.getByRole("radio", { name: dictionary.profile.settings.layouts.azerty }));

    expect(screen.getByRole("radio", { name: dictionary.profile.settings.layouts.azerty })).toBeChecked();
    expect(screen.getByRole("radio", { name: dictionary.profile.settings.layouts.qwerty })).not.toBeChecked();
  });

  it("modifier un champ puis cliquer sur « Enregistrer » (bouton rattaché par form=) appelle updateProfile", async () => {
    const dictionary = renderForm(locale);

    fireEvent.change(nameField(dictionary), { target: { value: "Alice C" } });
    await act(async () => {
      fireEvent.click(saveButton(dictionary));
    });

    expect(mocks.updateProfile).toHaveBeenCalledTimes(1);
    expect(mocks.updateProfile.mock.calls[0][0].get("displayName")).toBe("Alice C");
  });

  it("le compteur compte comme la validation : espaces de bord ignorés, rouge seulement au-delà de 20", () => {
    const dictionary = renderForm(locale);

    fireEvent.change(nameField(dictionary), { target: { value: `  ${"x".repeat(20)}  ` } });
    expect(screen.getByText("20 / 20")).not.toHaveClass("text-danger");
    expect(saveButton(dictionary)).toBeEnabled();

    fireEvent.change(nameField(dictionary), { target: { value: "x".repeat(21) } });
    expect(screen.getByText("21 / 20")).toHaveClass("text-danger");
  });

  it("l'envoi du formulaire enregistre le nouveau nom", async () => {
    const dictionary = renderForm(locale);

    fireEvent.change(nameField(dictionary), { target: { value: "Alice B" } });
    expect(saveButton(dictionary)).toBeEnabled();
    await act(async () => {
      fireEvent.submit(nameField(dictionary).closest("form") as HTMLFormElement);
    });

    expect(mocks.updateProfile.mock.calls[0][0].get("displayName")).toBe("Alice B");
  });

  it("un nom invalide affiche le message traduit et bloque l'enregistrement", async () => {
    const dictionary = renderForm(locale);

    fireEvent.change(nameField(dictionary), { target: { value: "x".repeat(21) } });
    fireEvent.blur(nameField(dictionary));

    expect(screen.getByText(dictionary.auth.errors.INVALID_PSEUDO)).toBeInTheDocument();
    expect(nameField(dictionary)).toHaveAttribute("aria-invalid", "true");
    expect(saveButton(dictionary)).toBeDisabled();
    await act(async () => {
      fireEvent.submit(nameField(dictionary).closest("form") as HTMLFormElement);
    });
    expect(mocks.updateProfile).not.toHaveBeenCalled();
  });

  it("affiche sur le champ l'erreur renvoyée par le serveur (nom déjà pris)", async () => {
    mocks.updateProfile.mockResolvedValue({ ok: false, code: "PSEUDO_TAKEN" });
    const dictionary = renderForm(locale);

    fireEvent.change(nameField(dictionary), { target: { value: "Bob" } });
    await act(async () => {
      fireEvent.submit(nameField(dictionary).closest("form") as HTMLFormElement);
    });

    expect(await screen.findByText(dictionary.auth.errors.PSEUDO_TAKEN)).toBeInTheDocument();
  });

  it("affiche une erreur de session dans une bannière", async () => {
    mocks.updateProfile.mockResolvedValue({ ok: false, code: "UNAUTHORIZED" });
    const dictionary = renderForm(locale);

    fireEvent.change(nameField(dictionary), { target: { value: "Bob" } });
    await act(async () => {
      fireEvent.submit(nameField(dictionary).closest("form") as HTMLFormElement);
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(dictionary.profile.errors.UNAUTHORIZED);
  });

  it("change de langue : enregistre puis va sur le profil dans la nouvelle langue", async () => {
    const other = locale === "fr" ? "en" : "fr";
    mocks.updateProfile.mockResolvedValue({ ok: true, locale: other });
    const dictionary = renderForm(locale);

    fireEvent.click(screen.getByRole("radio", { name: dictionary.language.names[other] }));
    await act(async () => {
      fireEvent.submit(nameField(dictionary).closest("form") as HTMLFormElement);
    });

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith(`/${other}/profile`));
  });

  it("« Annuler » rétablit les valeurs d'origine", () => {
    const dictionary = renderForm(locale);

    fireEvent.change(nameField(dictionary), { target: { value: "Autre" } });
    fireEvent.click(screen.getByRole("button", { name: dictionary.profile.actions.cancel }));

    expect(nameField(dictionary)).toHaveValue("Alice");
  });

  it("la déconnexion est un formulaire séparé qui porte la langue", () => {
    const dictionary = renderForm(locale);

    const button = screen.getByRole("button", { name: dictionary.profile.actions.logout });
    const logoutForm = button.closest("form");
    expect(button).toHaveAttribute("type", "submit");
    expect(logoutForm).not.toBe(nameField(dictionary).closest("form"));
    expect(logoutForm?.querySelector<HTMLInputElement>('input[name="locale"]')?.value).toBe(locale);
  });

  it("un invité n'a ni comptes reliés ni sécurité, et son identifiant est « aucun »", () => {
    const dictionary = renderForm(locale, guest);

    expect(screen.queryByText(dictionary.profile.security.linkedAccounts)).toBeNull();
    expect(screen.getByRole("textbox", { name: dictionary.profile.identity.username })).toHaveValue(
      dictionary.profile.identity.noUsername,
    );
    expect(screen.getByText(dictionary.header.guest)).toBeInTheDocument();
  });
});
