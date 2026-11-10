import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RaceScreen } from "./RaceScreen";
import { getDictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { DEFAULT_RACE_SETTINGS, serializeRaceSettings, type RaceSettings } from "@/race/config";
import { nextRaceText } from "@/app/[lang]/race/actions";
import { plain } from "@/test/text";

// La scène Pixi n'a pas de sens dans jsdom : un faux visualiseur expose juste les coureurs.
vi.mock("@/components/race/RaceVisualizer", () => ({
  RaceVisualizer: ({ racers }: { racers: { id: string }[] }) => <div data-testid="visualizer">{racers.length}</div>,
}));

// La server action est la frontière réseau ; le corpus reste côté serveur.
vi.mock("@/app/[lang]/race/actions", async () => {
  const { createRaceText } = await import("@/race/raceText");
  const { TEST_CORPUS } = await import("@/test/corpus");
  return { nextRaceText: vi.fn(async ({ settings, previous }: { settings: RaceSettings; previous?: string }) => {
    const text = createRaceText(settings, Math.random, previous, TEST_CORPUS);
    return text === null ? { ok: false as const, error: "NO_TEXT_AVAILABLE" as const } : { ok: true as const, text };
  }) };
});

const SETTINGS: RaceSettings = { ...DEFAULT_RACE_SETTINGS, bots: ["beginner", "beginner"], timeLimitSeconds: 60 };
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

function setup(overrides: { settings?: Partial<RaceSettings>; locale?: Locale; initialText?: string | null; initialError?: "RATE_LIMITED"; random?: () => number } = {}) {
  const locale = overrides.locale ?? "fr";
  const labels = getDictionary(locale).raceScreen;
  const settings = { ...SETTINGS, ...overrides.settings };
  const view = render(
    <RaceScreen
      locale={locale}
      labels={labels}
      roomLabels={getDictionary(locale).room.race}
      siteName="Typio"
      settings={settings}
      userName="Aurel"
      initialText={overrides.initialText === undefined ? TEXT : overrides.initialText}
      initialError={overrides.initialError}
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
  screen.getByText(plain(labels.stats.accuracy)).nextElementSibling?.textContent;
const textOnScreen = () => document.getElementById("race-text")?.textContent;

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("matchMedia", vi.fn(() => ({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })));
  clock = 10_000;
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("RaceScreen : horloge (A-D6, AC-4)", () => {
  it("affiche 3, 2, 1 puis démarre au départ, avec le temps restant visible", () => {
    const { labels } = setup();
    expect(screen.getAllByRole("status")[0]).toHaveTextContent(labels.status.countdown);
    expect(screen.getByTestId("countdown")).toHaveTextContent("3");
    expect(screen.getByRole("timer")).toHaveTextContent("01:00");
    // Saisie ignorée pendant le compte à rebours.
    type(input(labels), "a");
    expect(input(labels).value).toBe("");

    advance(2100);
    expect(screen.getByTestId("countdown")).toHaveTextContent("1");

    advance(900);
    expect(screen.getAllByRole("status")[0]).toHaveTextContent(labels.status.racing);
    expect(screen.getByRole("timer")).toHaveTextContent("01:00");
  });

  it("sans limite, masque le temps restant et affiche les résultats dès l'arrivée du joueur", () => {
    const { labels } = setup({ settings: { timeLimitSeconds: null, bots: ["noob"] } });
    expect(screen.queryByRole("timer")).not.toBeInTheDocument();
    expect(screen.queryByText(plain(labels.stats.timeLeft))).not.toBeInTheDocument();
    advance(3000);
    advance(1000);
    type(input(labels), TEXT);
    expect(screen.getAllByRole("status")[0]).toHaveTextContent(labels.status.finished);
    expect(screen.queryByLabelText(labels.typing.inputLabel)).not.toBeInTheDocument();
    advance(60_000);
    expect(screen.getAllByRole("status")[0]).toHaveTextContent(labels.status.finished);
  });

  it("annonce le compte à rebours une fois par seconde dans une région polie, puis « partez »", () => {
    const { labels } = setup();
    const announcement = () => screen.getByText((_, element) => element?.getAttribute("aria-live") === "polite" && element.tagName === "P" && element.getAttribute("role") !== "status");
    expect(announcement()).toHaveTextContent("3");
    advance(1100);
    expect(announcement()).toHaveTextContent("2");
    advance(1000);
    expect(announcement()).toHaveTextContent("1");
    advance(900);
    expect(announcement()).toHaveTextContent(plain(labels.go));
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
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(plain(labels.headline.racing));
    advance(5000);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(plain(labels.headline.timeout));
    expect(screen.getByRole("timer")).toHaveTextContent("00:00");
    expect(screen.getAllByRole("status")[0]).toHaveTextContent(labels.status.finished);
    expect(screen.queryByLabelText(labels.typing.inputLabel)).not.toBeInTheDocument();
  });
});

describe("RaceScreen : saisie (COURSE-04, A-D6)", () => {
  it("mode libre : on continue après une faute", () => {
    const { labels } = setup({ settings: { inputMode: "free" } });
    advance(3000);
    type(input(labels), "x");
    expect(input(labels).value).toBe("x");
    type(input(labels), "xb");
    expect(input(labels).value).toBe("xb");
    expect(screen.getByText(`1 / ${TEXT.length} ${labels.typing.characters}`)).toBeInTheDocument();
    // 2 frappes, 1 juste.
    expect(screen.getByText("50 %")).toBeInTheDocument();
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
    expect(screen.getByRole("table", { name: labels.results.tableTitle })).toHaveTextContent("91 %");
    expect(screen.getByText(/ 91 % /)).toBeInTheDocument();
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
    expect(accuracyShown(labels)).toBe("100\u00a0%");
  });

  it.each(["free", "blocking"] as const)("« ê » faux compte pour une seule frappe fausse (%s)", (inputMode) => {
    const { labels } = setup({ initialText: "ab", settings: { inputMode } });
    advance(3000);
    composeDeadKey(input(labels), "", "ê");
    expect(accuracyShown(labels)).toBe("0\u00a0%");
    // La frappe fausse n'est comptée qu'une fois, la touche morte « ^ » pas du tout.
    expect(input(labels).value).toBe(inputMode === "free" ? "ê" : "");
    type(input(labels), inputMode === "free" ? "êb" : "a");
    expect(accuracyShown(labels)).toBe("50\u00a0%");
  });

  it("garde un « ê » déjà tapé quand la composition suit des caractères", () => {
    const { labels } = setup({ initialText: "aêb" });
    advance(3000);
    type(input(labels), "a");
    composeDeadKey(input(labels), "a", "ê");
    type(input(labels), "aêb");
    expect(screen.getByRole("table", { name: labels.results.tableTitle })).toHaveTextContent("100 %");
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

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(plain(labels.headline.completed));
    expect(screen.getByRole("heading", { name: labels.results.podium })).toBeInTheDocument();
    const table = within(screen.getByRole("table", { name: labels.results.tableTitle }));
    expect(table.getAllByRole("row")).toHaveLength(1 + 3);
    for (const column of Object.values(labels.results.columns)) {
      expect(table.getByRole("columnheader", { name: column })).toBeInTheDocument();
    }
    const youRow = table.getByRole("rowheader", { name: labels.you }).closest("tr");
    expect(youRow).not.toBeNull();
    expect(within(youRow as HTMLElement).getByText("100 %")).toBeInTheDocument();
    expect(within(youRow as HTMLElement).getByText(labels.results.statuses.finished)).toBeInTheDocument();
    expect(within(youRow as HTMLElement).getByText("00:00.5")).toBeInTheDocument();
    // Les bots n'ont pas fini au bout de 0,5 s : joueur premier.
    expect(within(youRow as HTMLElement).getAllByRole("cell")[0]).toHaveTextContent("1er");
  });

  it("COURSE-07 : abandon classé dernier et marqué", () => {
    const { labels } = setup();
    expect(screen.getByRole("button", { name: labels.abandon })).toBeDisabled();
    advance(3000);
    advance(2000);
    const roomLabels = getDictionary("fr").room.race;
    fireEvent.click(screen.getByRole("button", { name: labels.abandon }));
    expect(screen.getByRole("group", { name: roomLabels.confirmAbandon })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: roomLabels.cancel })).toHaveFocus();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(plain(labels.headline.racing));
    fireEvent.click(screen.getByRole("button", { name: roomLabels.cancel }));
    expect(screen.queryByRole("group", { name: roomLabels.confirmAbandon })).not.toBeInTheDocument();
    expect(input(labels)).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: labels.abandon }));
    fireEvent.click(screen.getByRole("button", { name: roomLabels.confirm }));

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(labels.headline.abandoned);
    const youRow = within(screen.getByRole("table", { name: labels.results.tableTitle })).getByRole("rowheader", { name: labels.you }).closest("tr") as HTMLElement;
    expect(within(youRow).getByText(labels.results.statuses.abandoned)).toBeInTheDocument();
    expect(within(youRow).getAllByRole("cell")[0]).toHaveTextContent("3e");
  });

  it("Rejouer lance une nouvelle manche avec les mêmes réglages et un nouveau texte (AC-6)", async () => {
    let seed = 0;
    const random = () => {
      seed = (seed + 0.318) % 1;
      return seed;
    };
    const { labels, settings } = setup({ initialText: "first text", random });
    advance(3000);
    fireEvent.click(screen.getByRole("button", { name: labels.abandon }));
    fireEvent.click(screen.getByRole("button", { name: getDictionary("fr").room.race.confirm }));
    expect(screen.queryByLabelText(labels.typing.inputLabel)).not.toBeInTheDocument();

    vi.mocked(nextRaceText).mockClear();
    vi.mocked(nextRaceText).mockResolvedValueOnce({ ok: true, text: "brand new text" });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: labels.results.replay })); });
    // Nouveau tirage, mêmes réglages, en évitant le texte précédent ; son résultat est celui affiché.
    expect(nextRaceText).toHaveBeenCalledTimes(1);
    expect(nextRaceText).toHaveBeenCalledWith({ settings, previous: "first text" });
    expect(textOnScreen()).toBe("brand new text");
    expect(screen.getAllByRole("status")[0]).toHaveTextContent(labels.status.countdown);
    // Le focus est sur le champ de saisie, pas perdu sur <body>.
    expect(input(labels)).toHaveFocus();

    // Avec le vrai générateur, le deuxième tirage donne un texte différent du précédent.
    advance(3000);
    fireEvent.click(screen.getByRole("button", { name: labels.abandon }));
    fireEvent.click(screen.getByRole("button", { name: getDictionary("fr").room.race.confirm }));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: labels.results.replay })); });
    expect(textOnScreen()).not.toBe("brand new text");
    expect(textOnScreen()?.length).toBeGreaterThan(50);
  });

  it("Modifier les réglages renvoie vers la page de paramètres avec la configuration", () => {
    const { labels, settings } = setup();
    advance(3000);
    fireEvent.click(screen.getByRole("button", { name: labels.abandon }));
    fireEvent.click(screen.getByRole("button", { name: getDictionary("fr").room.race.confirm }));
    expect(screen.getByRole("link", { name: labels.results.editSettings })).toHaveAttribute(
      "href",
      `/fr/race/settings?${serializeRaceSettings(settings)}`,
    );
  });

  it.each([
    ["fr", "2e", "sur", "100\u00a0%"],
    ["en", "2nd", "of", "100%"],
  ] as const)("résultats en %s", (locale, ordinal, of, accuracy) => {
    const { labels } = setup({ locale, settings: { bots: ["beginner"] } });
    advance(3000);
    expect(accuracyShown(labels)).toBe(accuracy);
    fireEvent.click(screen.getByRole("button", { name: labels.abandon }));
    fireEvent.click(screen.getByRole("button", { name: getDictionary(locale).room.race.confirm }));
    expect(screen.getByText(new RegExp(`^${ordinal} ${of} 2 · `))).toHaveTextContent(plain(accuracy));
    expect(screen.getByRole("table", { name: labels.results.tableTitle })).toHaveTextContent(plain(accuracy));
    expect(screen.getByRole("region", { name: labels.results.tableTitle })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("heading", { name: labels.results.podium })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: labels.results.replay })).toBeInTheDocument();
    expect(screen.getByText(labels.results.statuses.abandoned)).toBeInTheDocument();
    expect(screen.getAllByText((name) => labels.botNames.some((bot) => name === `${bot} (${labels.bot} · ${labels.botLevels.beginner})`)).length).toBeGreaterThan(0);
  });
});

describe("RaceScreen : aucun texte (CONF-03)", () => {
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

  it("annonce le chargement puis affiche une erreur si la requête échoue", async () => {
    let rejectRequest: (error: Error) => void = () => {};
    vi.mocked(nextRaceText).mockImplementationOnce(() => new Promise((_, reject) => { rejectRequest = reject; }));
    const { labels } = setup();
    advance(3000);
    fireEvent.click(screen.getByRole("button", { name: labels.abandon }));
    fireEvent.click(screen.getByRole("button", { name: getDictionary("fr").room.race.confirm }));
    fireEvent.click(screen.getByRole("button", { name: labels.results.replay }));
    expect(screen.getByRole("status")).toHaveTextContent(labels.loading);
    await act(async () => { rejectRequest(new Error("network unavailable")); });
    expect(screen.getByRole("alert")).toHaveTextContent(labels.noText.message);
  });

  it("affiche le message si le texte d'une nouvelle manche est introuvable", async () => {
    const { labels } = setup({ settings: { excludedCharacters: "a e i o u y" } });
    advance(3000);
    fireEvent.click(screen.getByRole("button", { name: labels.abandon }));
    fireEvent.click(screen.getByRole("button", { name: getDictionary("fr").room.race.confirm }));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: labels.results.replay })); });
    expect(screen.getByRole("alert")).toHaveTextContent(labels.noText.message);
  });
});

describe("RaceScreen : bots (BOT-02, BOT-03)", () => {
  it("affiche le joueur et les bots nommés d'après le dictionnaire", () => {
    const { labels } = setup({ settings: { bots: ["beginner", "beginner", "beginner"] } });
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    expect(screen.getByTestId("visualizer")).toHaveTextContent("4");
    const names = screen.getAllByRole("listitem").slice(1).map((item) => item.children[1].textContent ?? "");
    expect(new Set(names).size).toBe(3);
    for (const name of names) expect(labels.botNames.map((bot) => `${bot} (${labels.bot} · ${labels.botLevels.beginner})`)).toContain(name);
  });

  it("se joue sans bot", () => {
    setup({ settings: { bots: [] } });
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });
});

it.each(["fr", "en"] as const)("distingue la limitation de débit initiale d’un corpus vide (%s)", (locale) => {
  const { labels } = setup({ locale, initialText: null, initialError: "RATE_LIMITED" });
  expect(screen.getByRole("alert")).toHaveTextContent(labels.noText.rateLimited);
});

it("affiche l’erreur de débit renvoyée lors d’une nouvelle manche", async () => {
  vi.mocked(nextRaceText).mockResolvedValueOnce({ ok: false, error: "RATE_LIMITED" });
  const { labels } = setup();
  advance(3000);
  fireEvent.click(screen.getByRole("button", { name: labels.abandon }));
  fireEvent.click(screen.getByRole("button", { name: getDictionary("fr").room.race.confirm }));
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: labels.results.replay })); });
  expect(screen.getByRole("alert")).toHaveTextContent(labels.noText.rateLimited);
});

it.each(["fr", "en"] as const)("DES-06 : remplace la saisie sans clavier physique (%s)", (locale) => {
  vi.mocked(window.matchMedia).mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() } as unknown as MediaQueryList);
  const { labels } = setup({ locale });
  advance(3000);
  expect(window.matchMedia).toHaveBeenCalledWith("(min-width: 768px) and (pointer: fine)");
  expect(screen.getByText(getDictionary(locale).room.race.keyboard)).toBeInTheDocument();
  expect(screen.queryByLabelText(labels.typing.inputLabel)).not.toBeInTheDocument();
});
