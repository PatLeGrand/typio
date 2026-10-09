import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RaceScreen } from "./RaceScreen";
import { getDictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { DEFAULT_RACE_SETTINGS, serializeRaceSettings, type RaceSettings } from "@/race/config";
import { createRaceText } from "@/race/raceText";

// La scène Pixi n'a pas de sens dans jsdom : un faux visualiseur expose juste les coureurs.
vi.mock("@/components/race/RaceVisualizer", () => ({
  RaceVisualizer: ({ racers }: { racers: { id: string }[] }) => <div data-testid="visualizer">{racers.length}</div>,
}));

// Le vrai générateur, mais espionné : on vérifie que « Rejouer » demande bien un nouveau tirage.
vi.mock("@/race/raceText", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/race/raceText")>();
  return { createRaceText: vi.fn(actual.createRaceText) };
});

const SETTINGS: RaceSettings = { ...DEFAULT_RACE_SETTINGS, botCount: 2, botDifficulty: "easy", timeLimitSeconds: 60 };
const TEXT = "ab cd";

/** Horloge manuelle : le temps ne bouge que lorsque le test le décide. */
let clock = 0;
const now = () => clock;

/** Avance l'horloge de `ms` et laisse passer un seul tick (les ticks réels peuvent être irréguliers). */
function advance(ms: number) {
  clock += ms;
  act(() => {
    vi.advanceTimersByTime(100);
  });
}

function setup(overrides: { settings?: Partial<RaceSettings>; locale?: Locale; initialText?: string | null; random?: () => number } = {}) {
  const locale = overrides.locale ?? "fr";
  const labels = getDictionary(locale).raceScreen;
  const settings = { ...SETTINGS, ...overrides.settings };
  const view = render(
    <RaceScreen
      locale={locale}
      labels={labels}
      siteName="Typio"
      settings={settings}
      userName="Aurel"
      initialText={overrides.initialText === undefined ? TEXT : overrides.initialText}
      botNameSeed={7}
      now={now}
      random={overrides.random ?? (() => 0.5)}
    />,
  );
  return { labels, settings, ...view };
}

const input = (labels: ReturnType<typeof getDictionary>["raceScreen"]) =>
  screen.getByLabelText(labels.typing.inputLabel) as HTMLInputElement;
const type = (field: HTMLInputElement, value: string) => fireEvent.change(field, { target: { value } });
/** Précision affichée dans le panneau de statistiques (et non celle d'un tableau ou d'un classement). */
const accuracyShown = (labels: ReturnType<typeof getDictionary>["raceScreen"]) =>
  screen.getByText(labels.stats.accuracy).nextElementSibling?.textContent;
const textOnScreen = () => document.getElementById("race-text")?.textContent;

beforeEach(() => {
  vi.useFakeTimers();
  clock = 10_000;
});
afterEach(() => {
  vi.useRealTimers();
});

describe("RaceScreen : horloge (A-D6, AC-4)", () => {
  it("affiche 3, 2, 1 puis démarre au départ, avec le temps restant visible", () => {
    const { labels } = setup();
    expect(screen.getByRole("status")).toHaveTextContent(labels.status.countdown);
    expect(screen.getByTestId("countdown")).toHaveTextContent("3");
    expect(screen.getByRole("timer")).toHaveTextContent("01:00");
    // Saisie ignorée pendant le compte à rebours.
    type(input(labels), "a");
    expect(input(labels).value).toBe("");

    advance(2100);
    expect(screen.getByTestId("countdown")).toHaveTextContent("1");

    advance(900);
    expect(screen.getByRole("status")).toHaveTextContent(labels.status.racing);
    expect(screen.getByRole("timer")).toHaveTextContent("01:00");
  });

  it("annonce le compte à rebours une fois par seconde dans une région polie, puis « partez »", () => {
    const { labels } = setup();
    const announcement = () => screen.getByText((_, element) => element?.getAttribute("aria-live") === "polite" && element.tagName === "P");
    expect(announcement()).toHaveTextContent("3");
    advance(1100);
    expect(announcement()).toHaveTextContent("2");
    advance(1000);
    expect(announcement()).toHaveTextContent("1");
    advance(900);
    expect(announcement()).toHaveTextContent(labels.go);
  });

  it("les premières frappes ne sont pas perdues : la saisie compte dès l'instant du départ, sans attendre le tick", () => {
    const { labels } = setup();
    clock += 3000; // le départ est passé, mais aucun tick n'a encore eu lieu
    type(input(labels), "a");
    expect(input(labels).value).toBe("a");
  });

  it("une course d'une minute finit à 60 s même quand les ticks sont irréguliers", () => {
    const { labels } = setup();
    advance(3000);
    advance(20_000);
    expect(screen.getByRole("timer")).toHaveTextContent("00:40");
    advance(39_000);
    expect(screen.getByRole("timer")).toHaveTextContent("00:01");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(labels.headline.racing);
    advance(5000);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(labels.headline.timeout);
    expect(screen.getByRole("timer")).toHaveTextContent("00:00");
    expect(screen.getByRole("status")).toHaveTextContent(labels.status.finished);
    expect(screen.queryByLabelText(labels.typing.inputLabel)).not.toBeInTheDocument();
  });
});

describe("RaceScreen : saisie (COURSE-7, A-D6)", () => {
  it("mode libre : on continue après une faute", () => {
    const { labels } = setup({ settings: { inputMode: "free" } });
    advance(3000);
    type(input(labels), "x");
    expect(input(labels).value).toBe("x");
    type(input(labels), "xb");
    expect(input(labels).value).toBe("xb");
    expect(screen.getByText(`1 / ${TEXT.length} ${labels.typing.characters}`)).toBeInTheDocument();
    // 2 frappes, 1 juste.
    expect(screen.getByText("50%")).toBeInTheDocument();
  });

  it("mode bloquant : le caractère faux n'entre pas", () => {
    const { labels } = setup({ settings: { inputMode: "blocking" } });
    advance(3000);
    type(input(labels), "x");
    expect(input(labels).value).toBe("");
    type(input(labels), "a");
    expect(input(labels).value).toBe("a");
  });

  it("bloque le coller", () => {
    const { labels } = setup();
    advance(3000);
    expect(fireEvent.paste(input(labels), { clipboardData: { getData: () => "ab cd" } })).toBe(false);
    expect(fireEvent.drop(input(labels))).toBe(false);
  });

  it("la précision compte la faute corrigée comme fausse (AC-5)", () => {
    const { labels } = setup({ initialText: "abcdefghij" });
    advance(3000);
    for (const value of ["a", "ab", "abc", "abcd", "abcde", "abcdex", "abcde", "abcdef", "abcdefg", "abcdefgh", "abcdefghi", "abcdefghij"]) {
      type(input(labels), value);
    }
    expect(screen.getByRole("table")).toHaveTextContent("91%");
    expect(screen.getByText(/ 91% /)).toBeInTheDocument();
  });
});

describe("RaceScreen : composition, touches mortes AZERTY et IME", () => {
  /** « ^ » puis « e » : le navigateur compose « ê » ; seule la valeur finale doit compter. */
  function composeDeadKey(field: HTMLInputElement, base: string, result: string) {
    fireEvent.compositionStart(field);
    type(field, `${base}^`);
    fireEvent.compositionUpdate(field, { data: "^" });
    expect(field.value).toBe(`${base}^`);
    type(field, `${base}${result}`);
    fireEvent.compositionEnd(field);
  }

  it.each(["free", "blocking"] as const)("« ê » juste compte pour une seule frappe juste (%s)", (inputMode) => {
    const { labels } = setup({ initialText: "êa", settings: { inputMode } });
    advance(3000);
    composeDeadKey(input(labels), "", "ê");
    expect(input(labels).value).toBe("ê");
    expect(screen.getByText(`1 / 2 ${labels.typing.characters}`)).toBeInTheDocument();
    expect(accuracyShown(labels)).toBe("100%");
  });

  it.each(["free", "blocking"] as const)("« ê » faux compte pour une seule frappe fausse (%s)", (inputMode) => {
    const { labels } = setup({ initialText: "ab", settings: { inputMode } });
    advance(3000);
    composeDeadKey(input(labels), "", "ê");
    expect(accuracyShown(labels)).toBe("0%");
    // La frappe fausse n'est comptée qu'une fois, la touche morte « ^ » pas du tout.
    expect(input(labels).value).toBe(inputMode === "free" ? "ê" : "");
    type(input(labels), inputMode === "free" ? "êb" : "a");
    expect(accuracyShown(labels)).toBe("50%");
  });

  it("garde un « ê » déjà tapé quand la composition suit des caractères", () => {
    const { labels } = setup({ initialText: "aêb" });
    advance(3000);
    type(input(labels), "a");
    composeDeadKey(input(labels), "a", "ê");
    type(input(labels), "aêb");
    expect(screen.getByRole("table")).toHaveTextContent("100%");
  });
});

describe("RaceScreen : curseur verrouillé en fin de champ", () => {
  it("ramène le curseur à la fin quand il est placé au milieu ou quand le texte est sélectionné", () => {
    const { labels } = setup({ initialText: "abcd" });
    advance(3000);
    const field = input(labels);
    type(field, "ab");
    field.setSelectionRange(0, 0);
    fireEvent.keyUp(field, { key: "ArrowLeft" });
    expect([field.selectionStart, field.selectionEnd]).toEqual([2, 2]);
    field.setSelectionRange(0, 2);
    fireEvent.mouseUp(field);
    expect([field.selectionStart, field.selectionEnd]).toEqual([2, 2]);
  });
});

describe("RaceScreen : fins et résultats (A-D7, AC-6)", () => {
  it("fin par le texte terminé : podium puis tableau avec MPM, précision, temps et rang", () => {
    const { labels } = setup();
    advance(3000);
    advance(500);
    for (const value of ["a", "ab", "ab ", "ab c", "ab cd"]) type(input(labels), value);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(labels.headline.completed);
    expect(screen.getByRole("heading", { name: labels.results.podium })).toBeInTheDocument();
    const table = within(screen.getByRole("table", { name: labels.results.tableTitle }));
    expect(table.getAllByRole("row")).toHaveLength(1 + 3);
    for (const column of Object.values(labels.results.columns)) {
      expect(table.getByRole("columnheader", { name: column })).toBeInTheDocument();
    }
    const youRow = table.getByRole("rowheader", { name: labels.you }).closest("tr");
    expect(youRow).not.toBeNull();
    expect(within(youRow as HTMLElement).getByText("100%")).toBeInTheDocument();
    expect(within(youRow as HTMLElement).getByText(labels.results.statuses.finished)).toBeInTheDocument();
    expect(within(youRow as HTMLElement).getByText("00:00.5")).toBeInTheDocument();
    // Les bots n'ont pas fini au bout de 0,5 s : joueur premier.
    expect(within(youRow as HTMLElement).getAllByRole("cell")[0]).toHaveTextContent("1er");
  });

  it("COURSE-5 : abandon classé dernier et marqué", () => {
    const { labels } = setup();
    expect(screen.getByRole("button", { name: labels.abandon })).toBeDisabled();
    advance(3000);
    advance(2000);
    fireEvent.click(screen.getByRole("button", { name: labels.abandon }));

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(labels.headline.abandoned);
    const youRow = within(screen.getByRole("table")).getByRole("rowheader", { name: labels.you }).closest("tr") as HTMLElement;
    expect(within(youRow).getByText(labels.results.statuses.abandoned)).toBeInTheDocument();
    expect(within(youRow).getAllByRole("cell")[0]).toHaveTextContent("3e");
  });

  it("Rejouer lance une nouvelle manche avec les mêmes réglages et un nouveau texte (AC-6)", () => {
    let seed = 0;
    const random = () => {
      seed = (seed + 0.318) % 1;
      return seed;
    };
    const { labels, settings } = setup({ initialText: "first text", random });
    advance(3000);
    fireEvent.click(screen.getByRole("button", { name: labels.abandon }));
    expect(screen.queryByLabelText(labels.typing.inputLabel)).not.toBeInTheDocument();

    vi.mocked(createRaceText).mockClear();
    vi.mocked(createRaceText).mockReturnValueOnce("brand new text");
    fireEvent.click(screen.getByRole("button", { name: labels.results.replay }));
    // Nouveau tirage, mêmes réglages, en évitant le texte précédent ; son résultat est celui affiché.
    expect(createRaceText).toHaveBeenCalledTimes(1);
    expect(createRaceText).toHaveBeenCalledWith(settings, random, "first text");
    expect(textOnScreen()).toBe("brand new text");
    expect(screen.getByRole("status")).toHaveTextContent(labels.status.countdown);
    // Le focus est sur le champ de saisie, pas perdu sur <body>.
    expect(input(labels)).toHaveFocus();

    // Avec le vrai générateur, le deuxième tirage donne un texte différent du précédent.
    advance(3000);
    fireEvent.click(screen.getByRole("button", { name: labels.abandon }));
    fireEvent.click(screen.getByRole("button", { name: labels.results.replay }));
    expect(textOnScreen()).not.toBe("brand new text");
    expect(textOnScreen()?.length).toBeGreaterThan(50);
  });

  it("Modifier les réglages renvoie vers la page de paramètres avec la configuration", () => {
    const { labels, settings } = setup();
    advance(3000);
    fireEvent.click(screen.getByRole("button", { name: labels.abandon }));
    expect(screen.getByRole("link", { name: labels.results.editSettings })).toHaveAttribute(
      "href",
      `/fr/race/settings?${serializeRaceSettings(settings)}`,
    );
  });

  it.each([
    ["fr", "2e", "sur"],
    ["en", "2nd", "of"],
  ] as const)("résultats en %s", (locale, ordinal, of) => {
    const { labels } = setup({ locale, settings: { botCount: 1 } });
    advance(3000);
    fireEvent.click(screen.getByRole("button", { name: labels.abandon }));
    expect(screen.getByText(new RegExp(`^${ordinal} ${of} 2 · `))).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: labels.results.podium })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: labels.results.replay })).toBeInTheDocument();
    expect(screen.getByText(labels.results.statuses.abandoned)).toBeInTheDocument();
    expect(screen.getAllByText((name) => labels.botNames.includes(name)).length).toBeGreaterThan(0);
  });
});

describe("RaceScreen : aucun texte (TEXTE-1)", () => {
  it("explique le problème et renvoie vers les réglages au lieu de lancer une course vide", () => {
    const { labels, settings } = setup({ initialText: null });
    expect(screen.getByRole("alert")).toHaveTextContent(labels.noText.message);
    expect(screen.getByRole("link", { name: labels.noText.back })).toHaveAttribute(
      "href",
      `/fr/race/settings?${serializeRaceSettings(settings)}`,
    );
    expect(screen.queryByLabelText(labels.typing.inputLabel)).not.toBeInTheDocument();
    expect(screen.queryByTestId("visualizer")).not.toBeInTheDocument();
  });

  it("affiche le message si le texte d'une nouvelle manche est introuvable", () => {
    const { labels } = setup({ settings: { excludedCharacters: "a e i o u y" } });
    advance(3000);
    fireEvent.click(screen.getByRole("button", { name: labels.abandon }));
    fireEvent.click(screen.getByRole("button", { name: labels.results.replay }));
    expect(screen.getByRole("alert")).toHaveTextContent(labels.noText.message);
  });
});

describe("RaceScreen : bots (BOT-2)", () => {
  it("affiche le joueur et botCount bots nommés d'après le dictionnaire", () => {
    const { labels } = setup({ settings: { botCount: 3 } });
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    expect(screen.getByTestId("visualizer")).toHaveTextContent("4");
    const names = screen.getAllByRole("listitem").slice(1).map((item) => item.children[1].textContent ?? "");
    expect(new Set(names).size).toBe(3);
    for (const name of names) expect(labels.botNames).toContain(name);
  });

  it("se joue sans bot", () => {
    setup({ settings: { botCount: 0 } });
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });
});
