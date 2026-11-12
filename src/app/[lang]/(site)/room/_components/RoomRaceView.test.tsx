import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { getDictionary } from "@/i18n/dictionaries";
import { makeParticipant, makeRoom, makeUseRoom, ME } from "@/test/roomFixtures";
import { RoomView } from "./RoomView";

const keyboard = vi.hoisted(() => ({ available: true }));
vi.mock("@/components/race/usePhysicalKeyboard", () => ({ usePhysicalKeyboard: () => keyboard.available }));
vi.mock("@/realtime/client", () => ({ getSocket: () => null }));
vi.mock("@/components/race/RaceVisualizer", () => ({ RaceVisualizer: () => <canvas aria-hidden="true" /> }));

beforeEach(() => { keyboard.available = true; });

function show(locale: "fr" | "en", status: "countdown" | "racing", solo = false) {
  const dict = getDictionary(locale);
  const room = makeRoom([makeParticipant(ME)], { status, solo });
  const abandonRace = vi.fn(async () => ({ ok: true as const, data: undefined }));
  const session = makeUseRoom({ room, abandonRace, raceReceivedAt: Date.now(), race: {
    status, serverNow: 1000, startAt: 4000, text: "Bonjour la piste", finishDeadline: 16000, bonusEvents: [],
    runners: Array.from({ length: 30 }, (_, index) => ({
      id: index === 0 ? ME : `bot-${index}`, name: index === 0 ? "Alice" : "UnPseudoDeTrenteCaracteresSansFin",
      kind: index === 0 ? "human" as const : "bot" as const, level: "beginner" as const,
      avatarVersion: null, status: "typing" as const, connected: true, position: index,
      progress: index / 100, edits: [], fogUntil: 0, textLength: 100, wpm: 25.5, accuracy: 100,
    })),
  } });
  render(<RoomView room={room} session={session} userId={ME} labels={dict.room} raceLabels={dict.raceScreen} settingsLabels={dict.raceSettings} lang={locale} error={null} leaving={false} onLeave={() => {}} onConfigChange={async () => {}} />);
  return { dict, abandonRace };
}

it.each(["fr", "en"] as const)("conserve la région de piste, les 30 coureurs et le code unique (%s)", (locale) => {
  const { dict } = show(locale, "countdown");
  const region = screen.getByRole("region", { name: dict.raceScreen.leaderboard });
  expect(region.querySelector("canvas")).toBeInTheDocument();
  expect(within(region).getAllByRole("listitem")).toHaveLength(30);
  expect(screen.getAllByText("ABC234")).toHaveLength(1);
  expect(within(region).getByRole("button", { name: dict.room.code.copy })).toBeInTheDocument();
  expect(within(region).getByText("Bonjour la piste")).toBeInTheDocument();
  expect(within(region).getByText(`Alice (${dict.raceScreen.you})`)).toBeInTheDocument();
});

it.each(["fr", "en"] as const)("solo : saisie et annulation de l'abandon gardent le focus (%s)", (locale) => {
  const { dict, abandonRace } = show(locale, "racing", true);
  expect(screen.queryByText("ABC234")).not.toBeInTheDocument();
  const input = screen.getByRole("textbox", { name: dict.raceScreen.typing.inputLabel });
  expect(input).toHaveFocus();
  expect(screen.getByRole("timer")).toBeInTheDocument();
  fireEvent.change(input, { target: { value: "B" } });
  expect(input).toHaveValue("B");
  fireEvent.click(screen.getByRole("button", { name: dict.raceScreen.abandon }));
  expect(screen.getByRole("button", { name: dict.room.race.cancel })).toHaveFocus();
  fireEvent.click(screen.getByRole("button", { name: dict.room.race.cancel }));
  expect(input).toHaveFocus();
  expect(abandonRace).not.toHaveBeenCalled();
});

it("mobile : garde la piste et le message clavier physique", () => {
  keyboard.available = false;
  const { dict } = show("fr", "racing");
  expect(screen.getByText(dict.room.race.keyboard)).toBeInTheDocument();
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  expect(screen.getByRole("region", { name: dict.raceScreen.leaderboard }).querySelector("canvas")).toBeInTheDocument();
});
