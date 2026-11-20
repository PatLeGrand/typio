import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import en from "@/i18n/dictionaries/en.json";
import fr from "@/i18n/dictionaries/fr.json";
import { DEFAULT_RACE_SETTINGS, type RaceSettings } from "@/race/config";
import { RaceSettingsFields } from "./RaceSettingsFields";
import { BOT_LEVEL_PROFILES } from "@/race/bots";
import { MAX_BOTS } from "@/realtime/protocol";
import { plain } from "@/test/text";

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

function openAdvanced(dict = copy) {
  const toggle = screen.getByRole("button", { name: new RegExp(dict.advanced.title) });
  if (toggle.getAttribute("aria-expanded") !== "true") fireEvent.click(toggle);
  return toggle;
}

describe("RaceSettingsFields (editable)", () => {
  it.each([
    [copy.textMode.words, { textMode: "words" }, false],
    [copy.language.en, { language: "en" }, false],
    [copy.accents.exclude, { accents: false }, true],
    [copy.inputMode.blocking, { inputMode: "blocking" }, true],
    [copy.timeLimit.minutes.replace("{minutes}", "3"), { timeLimitSeconds: 180 }, false],
  ])("choosing %s sends %j", (name, patch, advanced) => {
    const onChange = renderFields({ value: { timeLimitSeconds: 60 } });
    if (advanced) openAdvanced();
    fireEvent.click(screen.getByRole("radio", { name: new RegExp(`^${name}`) }));
    expect(onChange).toHaveBeenCalledWith(patch);
  });

  it("hides inclusion for whole sentences and shows it enabled for words", () => {
    const { rerender } = render(<RaceSettingsFields value={{ ...DEFAULT_RACE_SETTINGS }} onChange={vi.fn()} dict={copy} lang="fr" />);
    openAdvanced();
    expect(screen.queryByRole("textbox", { name: copy.includedChars.label })).toBeNull();
    rerender(<RaceSettingsFields value={{ ...DEFAULT_RACE_SETTINGS, textMode: "words" }} onChange={vi.fn()} dict={copy} lang="fr" />);
    expect(screen.getByRole("textbox", { name: copy.includedChars.label })).toBeEnabled();
    expect(screen.getByText(plain(copy.includedChars.help))).toBeInTheDocument();
  });

  it("shows only the description of the selected complexity and input mode", () => {
    const { rerender } = render(<RaceSettingsFields value={{ ...DEFAULT_RACE_SETTINGS }} onChange={vi.fn()} dict={copy} lang="fr" />);
    expect(screen.getByText(plain(copy.complexity.descriptions.medium))).toBeInTheDocument();
    expect(screen.queryByText(plain(copy.complexity.descriptions.easy))).toBeNull();
    expect(screen.queryByText(plain(copy.complexity.descriptions.hard))).toBeNull();

    openAdvanced();
    expect(screen.getByText(plain(copy.inputMode.freeDesc))).toBeInTheDocument();
    expect(screen.queryByText(plain(copy.inputMode.blockingDesc))).toBeNull();

    rerender(<RaceSettingsFields value={{ ...DEFAULT_RACE_SETTINGS, complexity: "hard", inputMode: "blocking" }} onChange={vi.fn()} dict={copy} lang="fr" />);
    expect(screen.getByText(plain(copy.complexity.descriptions.hard))).toBeInTheDocument();
    expect(screen.queryByText(plain(copy.complexity.descriptions.medium))).toBeNull();
    expect(screen.getByText(plain(copy.inputMode.blockingDesc))).toBeInTheDocument();
    expect(screen.queryByText(plain(copy.inputMode.freeDesc))).toBeNull();
  });

  it("sends a numeric word count from the dropdown", () => {
    const onChange = renderFields();
    fireEvent.change(screen.getByRole("combobox", { name: copy.length.label }), { target: { value: "100" } });
    expect(onChange).toHaveBeenCalledWith({ length: 100 });
  });

  it("picking no limit sends null", () => {
    const onChange = renderFields({ value: { timeLimitSeconds: 60 } });
    fireEvent.click(screen.getByRole("radio", { name: copy.timeLimit.none }));
    expect(onChange).toHaveBeenCalledWith({ timeLimitSeconds: null });
  });

  it("steps the bot count and stays within 0..7", () => {
    const onChange = renderFields({ value: { bots: ["intermediate", "intermediate"] } });
    fireEvent.change(screen.getByRole("combobox", { name: copy.bots.level.replace("{number}", "2") }), { target: { value: "expert" } });
    fireEvent.click(screen.getByRole("button", { name: copy.bots.add }));
    fireEvent.click(screen.getByRole("button", { name: copy.bots.remove.replace("{number}", "1") }));
    expect(onChange.mock.calls).toEqual([[{ bots: ["intermediate", "expert"] }], [{ bots: ["intermediate", "intermediate", "intermediate"] }], [{ bots: ["intermediate"] }]]);

    const atMax = renderFields({ value: { bots: ["intermediate", "intermediate", "intermediate", "intermediate", "intermediate", "intermediate", "intermediate"] } });
    fireEvent.click(screen.getAllByRole("button", { name: copy.bots.add })[1]);
    expect(atMax).not.toHaveBeenCalled();
  });

  it.each(["fr", "en"] as const)("shows only selected bot speeds and the empty state (%s)", (lang) => {
    const dict = lang === "fr" ? fr.raceSettings : en.raceSettings;
    const { rerender } = render(<RaceSettingsFields value={{ ...DEFAULT_RACE_SETTINGS, bots: ["expert"] }} onChange={vi.fn()} dict={dict} lang={lang} />);
    const speed = dict.bots.speed.replace("{min}", String(BOT_LEVEL_PROFILES.expert.minWpm)).replace("{max}", String(BOT_LEVEL_PROFILES.expert.maxWpm));
    expect(screen.getByRole("combobox", { name: dict.bots.level.replace("{number}", "1") })).toHaveAccessibleDescription(speed);
    expect(screen.getByText(speed)).toBeInTheDocument();
    rerender(<RaceSettingsFields value={{ ...DEFAULT_RACE_SETTINGS, bots: [] }} onChange={vi.fn()} dict={dict} lang={lang} />);
    expect(screen.getByText(dict.bots.empty)).toBeInTheDocument();
    expect(screen.queryByText(speed)).not.toBeInTheDocument();
  });

  it("disables adding when room capacity is reached", () => {
    renderFields({ value: { capacity: 2, bots: ["intermediate"] } });
    expect(screen.getByRole("button", { name: copy.bots.add })).toBeDisabled();
  });

  it("sends the typed excluded characters", () => {
    const onChange = renderFields();
    openAdvanced();
    fireEvent.change(screen.getByRole("textbox", { name: copy.excludedChars.label }), { target: { value: "@#" } });
    expect(onChange).toHaveBeenCalledWith({ excludedCharacters: "@#" });
  });

  it("enables the catch-up bonuses switch", () => {
    renderFields();
    openAdvanced();
    expect(screen.getByRole("switch", { name: copy.bonuses.label })).toBeEnabled();
  });

  it("auto-opens the advanced block and focuses the excluded characters field on error", () => {
    render(
      <RaceSettingsFields value={{ ...DEFAULT_RACE_SETTINGS }} onChange={vi.fn()} dict={copy} lang="fr" excludedError="oups" />,
    );
    const input = screen.getByRole("textbox", { name: copy.excludedChars.label });
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription(expect.stringContaining("oups"));
    expect(input).toHaveFocus();
  });

  it("auto-opens the advanced block and focuses the included characters field on error", () => {
    render(
      <RaceSettingsFields
        value={{ ...DEFAULT_RACE_SETTINGS, textMode: "words" }}
        onChange={vi.fn()}
        dict={copy}
        lang="fr"
        includedError="oups"
      />,
    );
    const input = screen.getByRole("textbox", { name: copy.includedChars.label });
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription(expect.stringContaining("oups"));
    expect(input).toHaveFocus();
  });

  it("re-opens the collapsed advanced block and moves focus when a character error arrives", () => {
    const { rerender } = render(
      <RaceSettingsFields value={{ ...DEFAULT_RACE_SETTINGS }} onChange={vi.fn()} dict={copy} lang="fr" />,
    );
    const toggle = screen.getByRole("button", { name: new RegExp(copy.advanced.title) });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    rerender(
      <RaceSettingsFields
        value={{ ...DEFAULT_RACE_SETTINGS, excludedCharacters: "x".repeat(101) }}
        onChange={vi.fn()}
        dict={copy}
        lang="fr"
        excludedError={copy.excludedChars.error}
        errorTrigger={1}
      />,
    );
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("textbox", { name: copy.excludedChars.label })).toHaveFocus();
  });

  it("counts modified advanced options with FR/EN plurals and ignores hidden includedCharacters outside words mode", () => {
    const { rerender, unmount } = render(
      <RaceSettingsFields value={{ ...DEFAULT_RACE_SETTINGS }} onChange={vi.fn()} dict={copy} lang="fr" />,
    );
    expect(screen.queryByText(/modifié/)).toBeNull();

    rerender(
      <RaceSettingsFields
        value={{ ...DEFAULT_RACE_SETTINGS, accents: false, includedCharacters: "ae" }}
        onChange={vi.fn()}
        dict={copy}
        lang="fr"
      />,
    );
    expect(screen.getByText("1 modifié")).toBeInTheDocument();

    rerender(
      <RaceSettingsFields
        value={{ ...DEFAULT_RACE_SETTINGS, textMode: "words", accents: false, includedCharacters: "ae" }}
        onChange={vi.fn()}
        dict={copy}
        lang="fr"
      />,
    );
    expect(screen.getByText("2 modifiés")).toBeInTheDocument();
    unmount();

    const enView = render(
      <RaceSettingsFields
        value={{ ...DEFAULT_RACE_SETTINGS, bonuses: true }}
        onChange={vi.fn()}
        dict={en.raceSettings}
        lang="en"
      />,
    );
    expect(screen.getByText("1 change")).toBeInTheDocument();
    enView.rerender(
      <RaceSettingsFields
        value={{ ...DEFAULT_RACE_SETTINGS, bonuses: true, numbers: true }}
        onChange={vi.fn()}
        dict={en.raceSettings}
        lang="en"
      />,
    );
    expect(screen.getByText("2 changes")).toBeInTheDocument();
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
    openAdvanced();
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
    openAdvanced(en.raceSettings);
    expect(screen.getByText("2 characters excluded")).toBeInTheDocument();
  });
});

describe("RaceSettingsFields (read only)", () => {
  it("shows the values, keeps the disclosure usable, and disables every control", () => {
    const onChange = renderFields({ readOnly: true, value: { language: "en", bots: ["intermediate", "intermediate", "intermediate"], excludedCharacters: "xy" } });

    expect(screen.getByRole("radio", { name: copy.language.en })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radiogroup", { name: copy.timeLimit.label })).toBeInTheDocument();
    const toggle = openAdvanced();
    expect(toggle).toBeEnabled();
    for (const radio of screen.getAllByRole("radio")) expect(radio).toBeDisabled();
    expect(screen.getByRole("button", { name: copy.bots.add })).toBeDisabled();
    expect(screen.getByRole("button", { name: copy.bots.remove.replace("{number}", "1") })).toBeDisabled();
    expect(screen.getByText(`3 / ${MAX_BOTS}`, { selector: "[aria-live]" })).toBeInTheDocument();
    const input = screen.getByRole("textbox", { name: copy.excludedChars.label });
    expect(input).toHaveValue("xy");
    expect(input).toHaveAttribute("readonly");

    fireEvent.click(screen.getByRole("radio", { name: copy.language.fr }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
