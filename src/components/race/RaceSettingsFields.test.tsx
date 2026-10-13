import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import en from "@/i18n/dictionaries/en.json";
import fr from "@/i18n/dictionaries/fr.json";
import { DEFAULT_RACE_SETTINGS, type RaceSettings } from "@/race/config";
import { RaceSettingsFields } from "./RaceSettingsFields";

const copy = fr.raceSettings;

function renderFields(options: { value?: Partial<RaceSettings>; readOnly?: boolean } = {}) {
  const onChange = vi.fn();
  render(
    <RaceSettingsFields
      value={{ ...DEFAULT_RACE_SETTINGS, ...options.value }}
      onChange={onChange}
      readOnly={options.readOnly}
      dict={copy}
      lang="fr"
    />,
  );
  return onChange;
}

describe("RaceSettingsFields (editable)", () => {
  it.each([
    [copy.textMode.words, { textMode: "words" }],
    [copy.language.en, { language: "en" }],
    [copy.accents.exclude, { accents: false }],
    [copy.length.long, { length: "long" }],
    [copy.length.short, { length: "short" }],
    [copy.inputMode.blocking, { inputMode: "blocking" }],
    [copy.botDifficulty.hard, { botDifficulty: "hard" }],
    [copy.timeLimit.minutes.replace("{minutes}", "3"), { timeLimitSeconds: 180 }],
  ])("choosing %s sends %j", (name, patch) => {
    const onChange = renderFields({ value: { timeLimitSeconds: 60 } });
    fireEvent.click(screen.getByRole("radio", { name: new RegExp(`^${name}`) }));
    expect(onChange).toHaveBeenCalledWith(patch);
  });

  it("picking no limit sends null", () => {
    const onChange = renderFields({ value: { timeLimitSeconds: 60 } });
    fireEvent.click(screen.getByRole("radio", { name: copy.timeLimit.none }));
    expect(onChange).toHaveBeenCalledWith({ timeLimitSeconds: null });
  });

  it("steps the bot count and stays within 0..7", () => {
    const onChange = renderFields({ value: { botCount: 2 } });
    fireEvent.click(screen.getByRole("button", { name: copy.botCount.increase }));
    fireEvent.click(screen.getByRole("button", { name: copy.botCount.decrease }));
    expect(onChange.mock.calls).toEqual([[{ botCount: 3 }], [{ botCount: 1 }]]);

    const atMax = renderFields({ value: { botCount: 7 } });
    fireEvent.click(screen.getAllByRole("button", { name: copy.botCount.increase })[1]);
    expect(atMax).toHaveBeenCalledWith({ botCount: 7 });
  });

  it("sends the typed excluded characters", () => {
    const onChange = renderFields();
    fireEvent.change(screen.getByRole("textbox", { name: copy.excludedChars.label }), { target: { value: "@#" } });
    expect(onChange).toHaveBeenCalledWith({ excludedCharacters: "@#" });
  });

  it("keeps the abilities switch disabled", () => {
    renderFields();
    expect(screen.getByRole("switch", { name: copy.abilities.label })).toBeDisabled();
  });

  it("shows the excluded characters error linked to the field", () => {
    render(
      <RaceSettingsFields value={{ ...DEFAULT_RACE_SETTINGS }} onChange={vi.fn()} dict={copy} lang="fr" excludedError="oups" />,
    );
    const input = screen.getByRole("textbox", { name: copy.excludedChars.label });
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription(expect.stringContaining("oups"));
  });

  it("reports the end of typing in the excluded characters field", () => {
    const onExcludedBlur = vi.fn();
    render(
      <RaceSettingsFields
        value={{ ...DEFAULT_RACE_SETTINGS }}
        onChange={vi.fn()}
        dict={copy}
        lang="fr"
        onExcludedBlur={onExcludedBlur}
      />,
    );
    fireEvent.blur(screen.getByRole("textbox", { name: copy.excludedChars.label }));
    expect(onExcludedBlur).toHaveBeenCalledTimes(1);
  });

  it("pluralizes the excluded count in English", () => {
    render(
      <RaceSettingsFields
        value={{ ...DEFAULT_RACE_SETTINGS, excludedCharacters: "ab" }}
        onChange={vi.fn()}
        dict={en.raceSettings}
        lang="en"
      />,
    );
    expect(screen.getByText("2 characters excluded")).toBeInTheDocument();
  });
});

describe("RaceSettingsFields (read only)", () => {
  it("shows the values but disables every control", () => {
    const onChange = renderFields({ readOnly: true, value: { language: "en", botCount: 3, excludedCharacters: "xy" } });

    expect(screen.getByRole("radio", { name: copy.language.en })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radiogroup", { name: copy.timeLimit.label })).toBeInTheDocument();
    for (const radio of screen.getAllByRole("radio")) expect(radio).toBeDisabled();
    expect(screen.getByRole("button", { name: copy.botCount.increase })).toBeDisabled();
    expect(screen.getByRole("button", { name: copy.botCount.decrease })).toBeDisabled();
    expect(screen.getByText("3")).toBeInTheDocument();
    const input = screen.getByRole("textbox", { name: copy.excludedChars.label });
    expect(input).toHaveValue("xy");
    expect(input).toHaveAttribute("readonly");

    fireEvent.click(screen.getByRole("radio", { name: copy.language.fr }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
