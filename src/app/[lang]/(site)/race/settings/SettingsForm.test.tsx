import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { SettingsForm } from "./SettingsForm";
import en from "@/i18n/dictionaries/en.json";
import fr from "@/i18n/dictionaries/fr.json";
import { DEFAULT_RACE_SETTINGS, serializeRaceSettings } from "@/race/config";
import type { TimeLimitSeconds } from "@/realtime/protocol";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

describe("SettingsForm", () => {
  it("announces the default timer and supports arrow-key selection", () => {
    render(<SettingsForm lang="fr" dict={fr.raceSettings} />);
    const timeLimit = screen.getByRole("radiogroup", { name: fr.raceSettings.timeLimit.label });
    expect(within(timeLimit).getByRole("radio", { name: fr.raceSettings.timeLimit.none })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText(fr.raceSettings.timeLimit.help)).toBeInTheDocument();
    const phrases = screen.getByRole("radio", { name: "Phrases" });
    phrases.focus();
    fireEvent.keyDown(phrases, { key: "ArrowRight" });
    expect(screen.getByRole("radio", { name: "Mots" })).toHaveFocus();
    expect(screen.getByRole("radio", { name: "Mots" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("switch", { name: fr.raceSettings.abilities.label })).toBeDisabled();
  });

  it("offers no limit and the protocol durations as radio choices, with no free numeric field", () => {
    render(<SettingsForm lang="fr" dict={fr.raceSettings} />);
    const timeLimit = screen.getByRole("radiogroup", { name: fr.raceSettings.timeLimit.label });
    expect(within(timeLimit).getAllByRole("radio").map((radio) => radio.textContent)).toEqual([
      "Aucune (5 min par défaut)", "1 min", "2 min", "3 min", "5 min", "10 min",
    ]);
    expect(screen.queryByRole("spinbutton")).toBeNull();
  });

  it.each([[1, 60], [2, 120], [3, 180], [5, 300], [10, 600]])("serializes a %s min limit as %s seconds", (minutes, seconds) => {
    render(<SettingsForm lang="fr" dict={fr.raceSettings} />);
    const timeLimit = screen.getByRole("radiogroup", { name: fr.raceSettings.timeLimit.label });
    fireEvent.click(within(timeLimit).getByRole("radio", { name: `${minutes} min` }));
    expect(within(screen.getByRole("complementary")).getByText(`${minutes} min`)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Lancer la course →" }));
    const expectedConfig = serializeRaceSettings({ ...DEFAULT_RACE_SETTINGS, timeLimitSeconds: seconds as TimeLimitSeconds });
    expect(mockPush).toHaveBeenCalledWith(`/fr/race?${expectedConfig}`);
  });

  it("goes back to no limit (null) after choosing a duration, and the summary says so", () => {
    render(<SettingsForm lang="fr" dict={fr.raceSettings} />);
    const timeLimit = screen.getByRole("radiogroup", { name: fr.raceSettings.timeLimit.label });
    fireEvent.click(within(timeLimit).getByRole("radio", { name: "2 min" }));
    fireEvent.click(within(timeLimit).getByRole("radio", { name: fr.raceSettings.timeLimit.none }));
    expect(within(screen.getByRole("complementary")).getByText(fr.raceSettings.timeLimit.noneShort)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Lancer la course →" }));
    const config = new URLSearchParams(mockPush.mock.calls[0][0].split("?")[1]).get("config");
    expect(JSON.parse(config ?? "{}")).toMatchObject({ timeLimitSeconds: null });
  });

  it("does not render the site header itself (the (site) layout provides it)", () => {
    render(<SettingsForm lang="fr" dict={fr.raceSettings} />);
    expect(screen.queryByRole("banner")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("blocks excessive exclusions", () => {
    render(<SettingsForm lang="fr" dict={fr.raceSettings} />);
    fireEvent.change(screen.getByRole("textbox", { name: fr.raceSettings.excludedChars.label }), { target: { value: "x".repeat(101) } });
    fireEvent.click(screen.getByRole("button", { name: "Lancer la course →" }));
    expect(screen.getByRole("alert")).toHaveTextContent(fr.raceSettings.excludedChars.error);
    expect(mockPush).not.toHaveBeenCalled();
  });
  beforeEach(() => {
    mockPush.mockClear();
  });

  it("affiche la page dans la langue demandée (français ou anglais)", () => {
    const { unmount } = render(<SettingsForm lang="fr" dict={fr.raceSettings} />);
    expect(screen.getByRole("heading", { name: "Paramètres de course" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lancer la course →" })).toBeInTheDocument();

    unmount();

    render(<SettingsForm lang="en" dict={en.raceSettings} />);
    expect(screen.getByRole("heading", { name: "Race settings" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start race →" })).toBeInTheDocument();
  });

  it("réinitialise les réglages par défaut", () => {
    render(<SettingsForm lang="fr" dict={fr.raceSettings} />);

    // Modifier une valeur (ex: texte -> mots)
    const motsRadio = screen.getByRole("radio", { name: "Mots" });
    fireEvent.click(motsRadio);
    expect(motsRadio).toHaveAttribute("aria-checked", "true");

    // Réinitialiser
    const resetButton = screen.getByRole("button", { name: "Réinitialiser" });
    fireEvent.click(resetButton);

    // Vérifier le retour au défaut (phrases)
    const phrasesRadio = screen.getByRole("radio", { name: "Phrases" });
    expect(phrasesRadio).toHaveAttribute("aria-checked", "true");
    expect(motsRadio).toHaveAttribute("aria-checked", "false");
  });

  it("accepte des exclusions vides et redirige avec la bonne URL", () => {
    render(<SettingsForm lang="fr" dict={fr.raceSettings} />);

    // Laisse les caractères exclus vides
    const excludeInput = screen.getByPlaceholderText("@ # %");
    fireEvent.change(excludeInput, { target: { value: "" } });

    // Modifie la longueur du texte
    const longRadio = screen.getByRole("radio", { name: "Long" });
    fireEvent.click(longRadio);

    // Lancer
    const startButton = screen.getByRole("button", { name: "Lancer la course →" });
    fireEvent.click(startButton);

    const expectedConfig = serializeRaceSettings({
      ...DEFAULT_RACE_SETTINGS,
      length: "long",
      excludedCharacters: ""
    });

    expect(mockPush).toHaveBeenCalledWith(`/fr/race?${expectedConfig}`);
  });
});

describe("SettingsForm accessibility and plurals", () => {
  it("links the excluded characters field to its count, help and error", () => {
    render(<SettingsForm lang="fr" dict={fr.raceSettings} />);
    const field = screen.getByRole("textbox", { name: fr.raceSettings.excludedChars.label });
    expect(field).toHaveAccessibleDescription(`0 caractère exclu ${fr.raceSettings.excludedChars.help}`);
    fireEvent.change(field, { target: { value: "x".repeat(101) } });
    fireEvent.click(screen.getByRole("button", { name: "Lancer la course →" }));
    expect(field).toHaveAccessibleDescription(expect.stringContaining(fr.raceSettings.excludedChars.error));
  });

  it("uses the singular and plural forms of the excluded characters count in French and English", () => {
    const { unmount } = render(<SettingsForm lang="fr" dict={fr.raceSettings} />);
    const frField = screen.getByRole("textbox", { name: fr.raceSettings.excludedChars.label });
    fireEvent.change(frField, { target: { value: "@" } });
    expect(screen.getByText("1 caractère exclu")).toBeInTheDocument();
    fireEvent.change(frField, { target: { value: "@ # %" } });
    expect(screen.getByText("3 caractères exclus")).toBeInTheDocument();
    unmount();

    render(<SettingsForm lang="en" dict={en.raceSettings} />);
    const enField = screen.getByRole("textbox", { name: en.raceSettings.excludedChars.label });
    expect(screen.getByText("0 characters excluded")).toBeInTheDocument();
    fireEvent.change(enField, { target: { value: "@" } });
    expect(screen.getByText("1 character excluded")).toBeInTheDocument();
    fireEvent.change(enField, { target: { value: "@ #" } });
    expect(screen.getByText("2 characters excluded")).toBeInTheDocument();
  });

  it("describes the time limit group and the abilities switch by their help text", () => {
    render(<SettingsForm lang="fr" dict={fr.raceSettings} />);
    expect(screen.getByRole("radiogroup", { name: fr.raceSettings.timeLimit.label })).toHaveAccessibleDescription(fr.raceSettings.timeLimit.help);
    expect(screen.getByRole("switch", { name: fr.raceSettings.abilities.label })).toHaveAccessibleDescription(fr.raceSettings.abilities.help);
  });

  it("announces the bot count politely when it changes", () => {
    render(<SettingsForm lang="fr" dict={fr.raceSettings} />);
    const value = screen.getByText(String(DEFAULT_RACE_SETTINGS.botCount), { selector: "span[aria-live]" });
    expect(value).toHaveAttribute("aria-live", "polite");
    fireEvent.click(screen.getByRole("button", { name: fr.raceSettings.botCount.increase }));
    expect(value).toHaveTextContent(String(DEFAULT_RACE_SETTINGS.botCount + 1));
  });
});
