import { describe, expect, it } from "vitest";
import { getDictionary } from "@/i18n/dictionaries";
import { DEFAULT_ROOM_CONFIG, TIME_LIMITS_SECONDS } from "@/realtime/protocol";
import { configFields, configPatch } from "./roomConfigFields";

describe.each(["fr", "en"] as const)("réglages de la salle (%s)", (locale) => {
  const labels = getDictionary(locale).room.config;

  it("propose toutes les valeurs du protocole, avec un libellé traduit chacune", () => {
    const byKey = Object.fromEntries(configFields(DEFAULT_ROOM_CONFIG, labels).map((f) => [f.key, f]));
    expect(byKey.textMode.options.map((o) => o.value)).toEqual(["sentences", "words"]);
    expect(byKey.language.options.map((o) => o.value)).toEqual(["fr", "en"]);
    expect(byKey.length.options.map((o) => o.value)).toEqual(["short", "medium", "long"]);
    expect(byKey.timeLimitSeconds.options.map((o) => o.value)).toEqual([
      "none",
      ...TIME_LIMITS_SECONDS.map(String),
    ]);
    for (const f of Object.values(byKey)) {
      for (const option of f.options) expect(option.label.trim()).not.toBe("");
    }
  });

  it("donne la valeur et le libellé courants", () => {
    const fields = configFields({ ...DEFAULT_ROOM_CONFIG, language: "en", timeLimitSeconds: 120 }, labels);
    expect(fields.find((f) => f.key === "language")).toMatchObject({ value: "en", valueLabel: labels.language.en });
    expect(fields.find((f) => f.key === "timeLimitSeconds")).toMatchObject({
      value: "120",
      valueLabel: labels.timeLimit["120"],
    });
  });

  it("sans limite choisie, la valeur est « none »", () => {
    const field = configFields(DEFAULT_ROOM_CONFIG, labels).find((f) => f.key === "timeLimitSeconds");
    expect(field).toMatchObject({ value: "none", valueLabel: labels.timeLimit.none });
  });
});

describe("configPatch", () => {
  it("convertit la valeur d'un select en patch du protocole", () => {
    expect(configPatch("textMode", "words")).toEqual({ textMode: "words" });
    expect(configPatch("timeLimitSeconds", "300")).toEqual({ timeLimitSeconds: 300 });
    expect(configPatch("timeLimitSeconds", "none")).toEqual({ timeLimitSeconds: null });
  });

  it("refuse une valeur hors protocole", () => {
    expect(configPatch("length", "enormous")).toBeNull();
    expect(configPatch("timeLimitSeconds", "45")).toBeNull();
  });
});
