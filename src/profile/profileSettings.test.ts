import { describe, expect, it } from "vitest";
import en from "@/i18n/dictionaries/en.json";
import fr from "@/i18n/dictionaries/fr.json";
import { profileErrorMessage } from "./profileErrors";
import { isKeyboardLayout, KEYBOARD_LAYOUTS, PROFILE_ERROR_CODES, validateProfileUpdate } from "./profileSettings";

const valid = { displayName: "Alice", keyboardLayout: "azerty", locale: "fr" };

describe("isKeyboardLayout", () => {
  it.each(KEYBOARD_LAYOUTS)("accepte %s", (layout) => {
    expect(isKeyboardLayout(layout)).toBe(true);
  });

  it.each(["canadian", "QWERTY", "", null, undefined, 3])("refuse %j", (value) => {
    expect(isKeyboardLayout(value)).toBe(false);
  });
});

describe("validateProfileUpdate", () => {
  it("accepte des réglages valides et rogne le nom affiché", () => {
    expect(validateProfileUpdate({ ...valid, displayName: "  Zoé  " })).toEqual({
      ok: true,
      value: { displayName: "Zoé", keyboardLayout: "azerty", locale: "fr" },
    });
  });

  it("accepte la disposition cmf stockée en base", () => {
    expect(validateProfileUpdate({ ...valid, keyboardLayout: "cmf" })).toMatchObject({ ok: true });
  });

  it.each(["", " ", "a", "x".repeat(21), "bad<name>", null, undefined, 12])(
    "refuse le nom affiché %j avec INVALID_PSEUDO",
    (displayName) => {
      expect(validateProfileUpdate({ ...valid, displayName })).toEqual({ ok: false, code: "INVALID_PSEUDO" });
    },
  );

  it("refuse une disposition inconnue (dont l'ancienne valeur « canadian »)", () => {
    expect(validateProfileUpdate({ ...valid, keyboardLayout: "canadian" })).toEqual({
      ok: false,
      code: "INVALID_SETTINGS",
    });
  });

  it("refuse une langue inconnue", () => {
    expect(validateProfileUpdate({ ...valid, locale: "de" })).toEqual({ ok: false, code: "INVALID_SETTINGS" });
  });

  it("refuse l'absence de disposition ou de langue", () => {
    expect(validateProfileUpdate({ displayName: "Alice", keyboardLayout: null, locale: "fr" })).toMatchObject({
      ok: false,
    });
    expect(validateProfileUpdate({ displayName: "Alice", keyboardLayout: "qwerty", locale: undefined })).toMatchObject({
      ok: false,
    });
  });
});

describe("profileErrorMessage", () => {
  it.each([
    ["fr", fr],
    ["en", en],
  ])("chaque code a un message traduit non vide (%s)", (_locale, dictionary) => {
    for (const code of PROFILE_ERROR_CODES) {
      expect(profileErrorMessage(code, dictionary).trim(), `message manquant pour ${code}`).not.toBe("");
    }
  });

  it("réutilise les messages d'authentification pour le pseudo", () => {
    expect(profileErrorMessage("INVALID_PSEUDO", fr)).toBe(fr.auth.errors.INVALID_PSEUDO);
    expect(profileErrorMessage("PSEUDO_TAKEN", en)).toBe(en.auth.errors.PSEUDO_TAKEN);
  });
});
