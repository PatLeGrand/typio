import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AUTH_ERROR_CODES, type AuthFormState } from "@/auth/types";
import { getDictionary } from "@/i18n/dictionaries";

const mocks = vi.hoisted(() => ({
  register: vi.fn<(state: AuthFormState, data: FormData) => Promise<AuthFormState>>(),
}));
vi.mock("@/auth/actions", () => ({ register: mocks.register }));

import { RegisterForm } from "./RegisterForm";

function renderForm(locale: "fr" | "en" = "fr") {
  const dictionary = getDictionary(locale);
  render(<RegisterForm locale={locale} labels={dictionary.register} common={dictionary.auth} />);
  return dictionary;
}

async function submit(): Promise<void> {
  await act(async () => {
    fireEvent.submit(document.querySelector("form") as HTMLFormElement);
  });
}

/** Nom accessible « début fin », avec ou sans espace entre les deux (voir la note sur jsdom). */
function nameWith(start: string, end: string): RegExp {
  const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escape(start)}\\s*${escape(end)}$`);
}

function type(label: string, value: string): void {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

beforeEach(() => {
  mocks.register.mockReset();
  mocks.register.mockResolvedValue({ status: "idle" });
});

describe("RegisterForm", () => {
  it.each(["fr", "en"] as const)("affiche les champs, la règle et la case obligatoire traduits (%s)", (locale) => {
    const { register } = renderForm(locale);

    expect(screen.getByRole("textbox", { name: register.pseudoLabel })).toHaveAttribute("name", "username");
    expect(screen.getByLabelText(register.passwordLabel, { selector: "input" })).toHaveAttribute("name", "password");
    expect(screen.getByLabelText(register.confirmLabel, { selector: "input" })).toHaveAttribute(
      "name",
      "passwordConfirm",
    );
    expect(screen.getByText(register.passwordRule)).toBeInTheDocument();

    expect(screen.getByRole("checkbox")).not.toBeChecked();
    expect(screen.getByRole("checkbox")).toBeRequired();
    expect(screen.getByRole("button", { name: register.submit })).toHaveAttribute("type", "submit");
  });

  it("n'a aucun champ e-mail", () => {
    renderForm();
    expect(document.querySelector('input[type="email"], input[name="email"]')).toBeNull();
  });

  it.each(["fr", "en"] as const)(
    "la case n'a qu'un lien, vers la confidentialité, dans un nouvel onglet annoncé (%s)",
    (locale) => {
      const { register } = renderForm(locale);

      // jsdom ne calcule pas la mise en page : l'espace entre le lien et la mention peut manquer.
      const link = screen.getByRole("link", { name: nameWith(register.privacyLink, register.newTab) });
      expect(link).toHaveAttribute("href", `/${locale}/privacy`);
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
      expect(screen.getAllByRole("link")).toHaveLength(1);
      expect(screen.getByRole("checkbox")).toHaveAccessibleName(
        nameWith(`${register.termsBefore}${register.privacyLink}`, `${register.newTab}${register.termsAfter}`),
      );
    },
  );

  it("le texte du consentement ne parle plus de conditions d'utilisation", () => {
    for (const locale of ["fr", "en"] as const) {
      const { register, auth } = getDictionary(locale);
      expect(JSON.stringify(register)).not.toMatch(/conditions d'utilisation|terms of use/i);
      expect(auth.errors.TERMS_REQUIRED).not.toMatch(/conditions d'utilisation|terms of use/i);
    }
  });

  it("cliquer sur le libellé de la case la coche", () => {
    renderForm();
    fireEvent.click(screen.getByText(getDictionary("fr").register.termsBefore, { exact: false }));
    expect(screen.getByRole("checkbox")).toBeChecked();
  });

  it("relie la règle du mot de passe au premier champ mot de passe", () => {
    const { register } = renderForm();
    expect(screen.getByLabelText(register.passwordLabel, { selector: "input" })).toHaveAccessibleDescription(
      register.passwordRule,
    );
  });

  it("envoie pseudo, mots de passe, consentement et langue à l'action", async () => {
    const { register } = renderForm("en");
    type(register.pseudoLabel, "Alice_B");
    type(register.passwordLabel, "correct-password1");
    type(register.confirmLabel, "correct-password1");
    fireEvent.click(screen.getByRole("checkbox"));

    await submit();

    const data = mocks.register.mock.calls[0][1];
    expect(data.get("username")).toBe("Alice_B");
    expect(data.get("password")).toBe("correct-password1");
    expect(data.get("passwordConfirm")).toBe("correct-password1");
    expect(data.get("terms")).toBe("on");
    expect(data.get("locale")).toBe("en");
  });

  it("n'envoie pas « terms » quand la case n'est pas cochée", async () => {
    renderForm();
    await submit();
    expect(mocks.register.mock.calls[0][1].has("terms")).toBe(false);
  });

  it("désactive le bouton pendant l'envoi", async () => {
    let finish: (state: AuthFormState) => void = () => {};
    mocks.register.mockReturnValue(new Promise<AuthFormState>((resolve) => (finish = resolve)));
    const { register } = renderForm();

    await submit();

    expect(screen.getByRole("button", { name: register.submit })).toHaveAttribute("aria-disabled", "true");

    await act(async () => finish({ status: "idle" }));
    expect(screen.getByRole("button", { name: register.submit })).not.toHaveAttribute("aria-disabled");
  });

  describe.each(["fr", "en"] as const)("erreurs (%s)", (locale) => {
    it("USERNAME_TAKEN et INVALID_USERNAME s'affichent sous le pseudo, avec le focus", async () => {
      for (const code of ["USERNAME_TAKEN", "INVALID_USERNAME"] as const) {
        mocks.register.mockResolvedValue({ status: "error", code, field: "username" });
        const { register, auth } = renderForm(locale);

        await submit();

        const input = screen.getByRole("textbox", { name: register.pseudoLabel });
        expect(input).toBeInvalid();
        expect(input).toHaveAccessibleDescription(auth.errors[code]);
        expect(input).toHaveFocus();
        document.body.replaceChildren();
      }
    });

    it("INVALID_PASSWORD s'affiche sous le mot de passe", async () => {
      mocks.register.mockResolvedValue({ status: "error", code: "INVALID_PASSWORD", field: "password" });
      const { register, auth } = renderForm(locale);

      await submit();

      const input = screen.getByLabelText(register.passwordLabel, { selector: "input" });
      expect(input).toBeInvalid();
      expect(input).toHaveAccessibleDescription(`${register.passwordRule} ${auth.errors.INVALID_PASSWORD}`);
      expect(input).toHaveFocus();
    });

    it("PASSWORD_MISMATCH s'affiche sous la confirmation", async () => {
      mocks.register.mockResolvedValue({ status: "error", code: "PASSWORD_MISMATCH", field: "passwordConfirm" });
      const { register, auth } = renderForm(locale);

      await submit();

      const input = screen.getByLabelText(register.confirmLabel, { selector: "input" });
      expect(input).toBeInvalid();
      expect(input).toHaveAccessibleDescription(auth.errors.PASSWORD_MISMATCH);
      expect(input).toHaveFocus();
    });

    it("TERMS_REQUIRED s'affiche sous la case, reliée à elle", async () => {
      mocks.register.mockResolvedValue({ status: "error", code: "TERMS_REQUIRED", field: "terms" });
      const { auth } = renderForm(locale);

      await submit();

      const checkbox = screen.getByRole("checkbox");
      expect(checkbox).toBeInvalid();
      expect(checkbox).toHaveAccessibleDescription(auth.errors.TERMS_REQUIRED);
      expect(checkbox).toHaveFocus();
    });

    it.each(["RATE_LIMITED", "UNKNOWN"] as const)("%s s'affiche dans l'alerte générale", async (code) => {
      mocks.register.mockResolvedValue({ status: "error", code });
      const { auth } = renderForm(locale);

      await submit();

      expect(screen.getByRole("alert")).toHaveTextContent(auth.errors[code]);
    });
  });

  it("chaque code d'erreur a un emplacement : champ ou alerte", async () => {
    for (const code of AUTH_ERROR_CODES) {
      mocks.register.mockResolvedValue({ status: "error", code });
      const { auth } = renderForm();

      await submit();

      expect(screen.getByRole("alert")).toHaveTextContent(auth.errors[code]);
      document.body.replaceChildren();
    }
  });

  it("conserve le pseudo et le consentement après une erreur, mais vide les mots de passe", async () => {
    mocks.register.mockResolvedValue({ status: "error", code: "PASSWORD_MISMATCH", field: "passwordConfirm" });
    const { register } = renderForm();
    type(register.pseudoLabel, "Alice_B");
    type(register.passwordLabel, "correct-password1");
    type(register.confirmLabel, "correct-password2");
    fireEvent.click(screen.getByRole("checkbox"));

    await submit();

    expect(screen.getByRole("textbox", { name: register.pseudoLabel })).toHaveValue("Alice_B");
    expect(screen.getByRole("checkbox")).toBeChecked();
    expect(screen.getByLabelText(register.passwordLabel, { selector: "input" })).toHaveValue("");
    expect(screen.getByLabelText(register.confirmLabel, { selector: "input" })).toHaveValue("");
  });
});
