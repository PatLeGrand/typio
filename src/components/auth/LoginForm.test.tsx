import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AUTH_ERROR_CODES, type AuthFormState } from "@/auth/types";
import { getDictionary } from "@/i18n/dictionaries";

const mocks = vi.hoisted(() => ({ login: vi.fn<(state: AuthFormState, data: FormData) => Promise<AuthFormState>>() }));
vi.mock("@/auth/actions", () => ({ login: mocks.login }));

import { LoginForm } from "./LoginForm";

function renderForm(locale: "fr" | "en" = "fr") {
  const dictionary = getDictionary(locale);
  render(<LoginForm locale={locale} labels={dictionary.login} common={dictionary.auth} />);
  return dictionary;
}

async function submit(): Promise<void> {
  await act(async () => {
    fireEvent.submit(document.querySelector("form") as HTMLFormElement);
  });
}

function type(label: string, value: string): void {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

beforeEach(() => {
  mocks.login.mockReset();
  mocks.login.mockResolvedValue({ status: "idle" });
});

describe("LoginForm", () => {
  it.each(["fr", "en"] as const)("affiche champs, case décochée et bouton traduits (%s)", (locale) => {
    const { login, auth } = renderForm(locale);

    expect(screen.getByRole("textbox", { name: login.usernameLabel })).toHaveAttribute("name", "username");
    expect(screen.getByLabelText(auth.passwordLabel)).toHaveAttribute("name", "password");
    expect(screen.getByLabelText(auth.passwordLabel)).toHaveAttribute("type", "password");
    expect(screen.getByRole("checkbox", { name: login.remember })).not.toBeChecked();
    expect(screen.getByRole("button", { name: login.submit })).toHaveAttribute("type", "submit");
  });

  it("porte la langue en champ caché", () => {
    renderForm("en");
    const hidden = document.querySelector<HTMLInputElement>('input[name="locale"]');
    expect(hidden).toHaveAttribute("type", "hidden");
    expect(hidden?.value).toBe("en");
  });

  it("le bouton œil affiche puis masque le mot de passe", () => {
    const { auth } = renderForm();

    fireEvent.click(screen.getByRole("button", { name: auth.showPassword }));
    expect(screen.getByLabelText(auth.passwordLabel)).toHaveAttribute("type", "text");
    fireEvent.click(screen.getByRole("button", { name: auth.hidePassword }));
    expect(screen.getByLabelText(auth.passwordLabel)).toHaveAttribute("type", "password");
  });

  it("envoie identifiant, mot de passe, langue et case cochée à l'action", async () => {
    const { login, auth } = renderForm("en");
    type(login.usernameLabel, "alice");
    type(auth.passwordLabel, "correct-password1");
    fireEvent.click(screen.getByRole("checkbox", { name: login.remember }));

    await submit();

    expect(mocks.login).toHaveBeenCalledTimes(1);
    const data = mocks.login.mock.calls[0][1];
    expect(data.get("username")).toBe("alice");
    expect(data.get("password")).toBe("correct-password1");
    expect(data.get("remember")).toBe("on");
    expect(data.get("locale")).toBe("en");
  });

  it("n'envoie pas « remember » quand la case reste décochée", async () => {
    const { login, auth } = renderForm();
    type(login.usernameLabel, "alice");
    type(auth.passwordLabel, "correct-password1");

    await submit();

    expect(mocks.login.mock.calls[0][1].has("remember")).toBe(false);
  });

  it("désactive le bouton pendant l'envoi puis le réactive", async () => {
    let finish: (state: AuthFormState) => void = () => {};
    mocks.login.mockReturnValue(new Promise<AuthFormState>((resolve) => (finish = resolve)));
    const { login } = renderForm();

    await submit();
    expect(screen.getByRole("button", { name: login.submit })).toBeDisabled();

    await act(async () => finish({ status: "idle" }));
    expect(screen.getByRole("button", { name: login.submit })).toBeEnabled();
  });

  it("n'affiche aucune erreur tant que rien n'a échoué", () => {
    renderForm();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  describe.each(["fr", "en"] as const)("erreurs sans champ (%s)", (locale) => {
    it.each(AUTH_ERROR_CODES)("%s s'affiche traduit dans l'alerte générale", async (code) => {
      mocks.login.mockResolvedValue({ status: "error", code });
      const { auth } = renderForm(locale);

      await submit();

      expect(screen.getByRole("alert")).toHaveTextContent(auth.errors[code]);
    });
  });

  it("conserve l'identifiant et la case « Rester connecté » après une erreur, mais pas le mot de passe", async () => {
    mocks.login.mockResolvedValue({ status: "error", code: "INVALID_CREDENTIALS" });
    const { login, auth } = renderForm();
    type(login.usernameLabel, "alice");
    type(auth.passwordLabel, "wrong-password1");
    fireEvent.click(screen.getByRole("checkbox", { name: login.remember }));

    await submit();

    expect(screen.getByRole("alert")).toHaveTextContent(auth.errors.INVALID_CREDENTIALS);
    expect(screen.getByRole("textbox", { name: login.usernameLabel })).toHaveValue("alice");
    expect(screen.getByRole("checkbox", { name: login.remember })).toBeChecked();
    expect(screen.getByLabelText(auth.passwordLabel)).toHaveValue("");
  });

  it("une erreur de champ s'affiche sous le champ, reliée à lui, avec le focus", async () => {
    mocks.login.mockResolvedValue({ status: "error", code: "INVALID_USERNAME", field: "username" });
    const { login, auth } = renderForm();

    await submit();

    const input = screen.getByRole("textbox", { name: login.usernameLabel });
    expect(input).toBeInvalid();
    expect(input).toHaveAccessibleDescription(auth.errors.INVALID_USERNAME);
    expect(input).toHaveFocus();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
