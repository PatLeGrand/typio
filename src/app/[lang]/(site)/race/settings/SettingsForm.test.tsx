import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { SettingsForm } from "./SettingsForm";
import en from "@/i18n/dictionaries/en.json";
import fr from "@/i18n/dictionaries/fr.json";
import { DEFAULT_RACE_SETTINGS, serializeRaceSettings } from "@/race/config";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

describe("SettingsForm", () => {
  it("announces the default timer and supports arrow-key selection", () => {
    render(<SettingsForm lang="fr" dict={fr.raceSettings} siteName={fr.site.name} />);
    expect(screen.getByRole("switch", { name: fr.raceSettings.timeLimit.label })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByText(fr.raceSettings.timeLimit.help)).toBeInTheDocument();
    const phrases = screen.getByRole("radio", { name: "Phrases" });
    phrases.focus();
    fireEvent.keyDown(phrases, { key: "ArrowRight" });
    expect(screen.getByRole("radio", { name: "Mots" })).toHaveFocus();
    expect(screen.getByRole("radio", { name: "Mots" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("switch", { name: fr.raceSettings.abilities.label })).toBeDisabled();
  });

  it.each(["601", "1.5"])("blocks invalid duration %s", (value) => {
    render(<SettingsForm lang="fr" dict={fr.raceSettings} siteName={fr.site.name} />);
    fireEvent.click(screen.getByRole("switch", { name: fr.raceSettings.timeLimit.label }));
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value } });
    fireEvent.click(screen.getByRole("button", { name: "Lancer la course →" }));
    expect(screen.getByRole("alert")).toHaveTextContent(fr.raceSettings.timeLimit.error);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("blocks excessive exclusions", () => {
    render(<SettingsForm lang="fr" dict={fr.raceSettings} siteName={fr.site.name} />);
    fireEvent.change(screen.getByRole("textbox", { name: fr.raceSettings.excludedChars.label }), { target: { value: "x".repeat(101) } });
    fireEvent.click(screen.getByRole("button", { name: "Lancer la course →" }));
    expect(screen.getByRole("alert")).toHaveTextContent(fr.raceSettings.excludedChars.error);
    expect(mockPush).not.toHaveBeenCalled();
  });
  beforeEach(() => {
    mockPush.mockClear();
  });

  it("affiche la page dans la langue demandée (français ou anglais)", () => {
    const { unmount } = render(<SettingsForm lang="fr" dict={fr.raceSettings} siteName={fr.site.name} />);
    expect(screen.getByRole("heading", { name: "Paramètres de course" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lancer la course →" })).toBeInTheDocument();

    unmount();

    render(<SettingsForm lang="en" dict={en.raceSettings} siteName={en.site.name} />);
    expect(screen.getByRole("heading", { name: "Race settings" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start race →" })).toBeInTheDocument();
  });

  it("réinitialise les réglages par défaut", () => {
    render(<SettingsForm lang="fr" dict={fr.raceSettings} siteName={fr.site.name} />);

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

  it("affiche une erreur si la durée est invalide", () => {
    render(<SettingsForm lang="fr" dict={fr.raceSettings} siteName={fr.site.name} />);

    // Activer la limite de temps
    const timerSwitch = screen.getAllByRole("switch")[0]; // time limit
    if (timerSwitch.getAttribute("aria-checked") === "false") {
      fireEvent.click(timerSwitch);
    }

    // Mettre 0 (invalide)
    const timerInput = screen.getByRole("spinbutton");
    fireEvent.change(timerInput, { target: { value: "0" } });

    // Lancer
    const startButton = screen.getByRole("button", { name: "Lancer la course →" });
    fireEvent.click(startButton);

    // Erreur attendue, pas de redirection
    expect(screen.getByText("Entre 1 et 600 secondes.")).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("accepte des exclusions vides et redirige avec la bonne URL", () => {
    render(<SettingsForm lang="fr" dict={fr.raceSettings} siteName={fr.site.name} />);

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
