import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AUTH_ERROR_CODES, type AuthFormState } from "@/auth/types";
import { getDictionary } from "@/i18n/dictionaries";

const mocks = vi.hoisted(() => ({
  continueAsGuest: vi.fn<(state: AuthFormState, data: FormData) => Promise<AuthFormState>>(),
}));
vi.mock("@/auth/actions", () => ({ continueAsGuest: mocks.continueAsGuest }));

import { GuestForm } from "./GuestForm";

function renderForm(locale: "fr" | "en" = "fr") {
  const dictionary = getDictionary(locale);
  render(<GuestForm locale={locale} labels={dictionary.guest} common={dictionary.auth} />);
  return dictionary;
}

async function submit(): Promise<void> {
  await act(async () => {
    fireEvent.submit(document.querySelector("form") as HTMLFormElement);
  });
}

beforeEach(() => {
  mocks.continueAsGuest.mockReset();
  mocks.continueAsGuest.mockResolvedValue({ status: "idle" });
});

describe("GuestForm", () => {
  it.each(["fr", "en"] as const)("affiche le champ pseudo, son aide et le bouton traduits (%s)", (locale) => {
    const { guest } = renderForm(locale);

    const input = screen.getByRole("textbox", { name: guest.pseudoLabel });
    expect(input).toHaveAttribute("name", "pseudo");

    expect(screen.getByRole("button", { name: guest.submit })).toHaveAttribute("type", "submit");
  });

  it("envoie le pseudo et la langue à l'action", async () => {
    const { guest } = renderForm("en");
    fireEvent.change(screen.getByRole("textbox", { name: guest.pseudoLabel }), { target: { value: "Zoé" } });

    await submit();

    const data = mocks.continueAsGuest.mock.calls[0][1];
    expect(data.get("pseudo")).toBe("Zoé");
    expect(data.get("locale")).toBe("en");
  });

  it("désactive le bouton pendant l'envoi", async () => {
    let finish: (state: AuthFormState) => void = () => {};
    mocks.continueAsGuest.mockReturnValue(new Promise<AuthFormState>((resolve) => (finish = resolve)));
    const { guest } = renderForm();

    await submit();

    expect(screen.getByRole("button", { name: guest.submit })).toHaveAttribute("aria-disabled", "true");

    await act(async () => finish({ status: "idle" }));
    expect(screen.getByRole("button", { name: guest.submit })).not.toHaveAttribute("aria-disabled");
  });

  describe.each(["fr", "en"] as const)("erreurs (%s)", (locale) => {
    it("INVALID_PSEUDO s'affiche sous le champ, avec le focus, et le pseudo est conservé", async () => {
      mocks.continueAsGuest.mockResolvedValue({ status: "error", code: "INVALID_PSEUDO", field: "pseudo" });
      const { guest, auth } = renderForm(locale);
      fireEvent.change(screen.getByRole("textbox", { name: guest.pseudoLabel }), { target: { value: "<b>" } });

      await submit();

      const input = screen.getByRole("textbox", { name: guest.pseudoLabel });
      expect(input).toBeInvalid();
      expect(input).toHaveAccessibleDescription(auth.errors.INVALID_PSEUDO);
      expect(input).toHaveFocus();
      expect(input).toHaveValue("<b>");
    });

    it.each(AUTH_ERROR_CODES.filter((code) => code !== "INVALID_PSEUDO"))(
      "%s sans champ s'affiche dans l'alerte générale",
      async (code) => {
        mocks.continueAsGuest.mockResolvedValue({ status: "error", code });
        const { auth } = renderForm(locale);

        await submit();

        expect(screen.getByRole("alert")).toHaveTextContent(auth.errors[code]);
      },
    );
  });
});
