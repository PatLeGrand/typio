import { describe, expect, it } from "vitest";
import { AUTH_ERROR_CODES, type AuthFormState } from "@/auth/types";
import { getDictionary } from "@/i18n/dictionaries";
import { getAuthErrorView } from "./authErrors";

const messages = getDictionary("fr").auth.errors;

describe("getAuthErrorView", () => {
  it("ne montre rien tant qu'il n'y a pas d'erreur", () => {
    expect(getAuthErrorView({ status: "idle" }, messages, ["username"])).toEqual({ fieldErrors: {} });
  });

  it("place l'erreur sous le champ désigné par le serveur", () => {
    const state: AuthFormState = { status: "error", code: "USERNAME_TAKEN", field: "username" };

    expect(getAuthErrorView(state, messages, ["username", "password"])).toEqual({
      fieldErrors: { username: messages.USERNAME_TAKEN },
    });
  });

  it("place une erreur sans champ en message général", () => {
    const state: AuthFormState = { status: "error", code: "INVALID_CREDENTIALS" };

    expect(getAuthErrorView(state, messages, ["username"])).toEqual({
      fieldErrors: {},
      general: messages.INVALID_CREDENTIALS,
    });
  });

  it("replie sur le message général quand le champ désigné n'est pas dans ce formulaire", () => {
    const state: AuthFormState = { status: "error", code: "PASSWORD_MISMATCH", field: "passwordConfirm" };

    expect(getAuthErrorView(state, messages, ["username"])).toEqual({
      fieldErrors: {},
      general: messages.PASSWORD_MISMATCH,
    });
  });

  it.each(AUTH_ERROR_CODES)("traduit le code %s", (code) => {
    const view = getAuthErrorView({ status: "error", code }, messages, []);
    expect(view.general).toBe(messages[code]);
  });
});
