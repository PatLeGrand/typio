import { StrictMode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RacePage, { generateMetadata } from "./page";
import { SoloRaceEntry } from "./SoloRaceEntry";
import { DEFAULT_RACE_SETTINGS, serializeRaceSettings } from "@/race/config";
import { toSoloConfig } from "@/components/race/roomSettings";
import { getDictionary } from "@/i18n/dictionaries";
import { plain } from "@/test/text";

const mocks = vi.hoisted(() => ({
  user: vi.fn(), replace: vi.fn(), startSolo: vi.fn(), connection: "connected",
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/fr/race", useRouter: () => ({ replace: mocks.replace }) }));
vi.mock("@/auth/currentUser", () => ({ getCurrentUser: mocks.user }));
vi.mock("@/auth/actions", () => ({ continueAsGuest: vi.fn() }));
vi.mock("@/realtime/useRoom", () => ({ useRoom: () => ({ connection: mocks.connection, startSolo: mocks.startSolo }) }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.connection = "connected";
  mocks.user.mockResolvedValue({ id: "member-1", kind: "member" });
  mocks.startSolo.mockResolvedValue({ ok: true, data: { code: "ABC234" } });
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
});
afterEach(() => vi.unstubAllGlobals());

const props = (lang = "fr", config?: string | string[]) => ({
  params: Promise.resolve({ lang }), searchParams: Promise.resolve({ config }),
});

describe("race route boundary", () => {
  it.each(["fr", "en"] as const)("rejects repeated configuration parameters (%s)", async (lang) => {
    const { raceEntry, site } = getDictionary(lang);
    render(await RacePage(props(lang, ["{}", "{}"])));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(raceEntry.invalidTitle);
    expect(await generateMetadata(props(lang, ["{}", "{}"]))).toEqual({ title: `${raceEntry.invalidTitle} | ${site.name}` });
    expect(screen.getByRole("alert")).toHaveTextContent(raceEntry.invalid);
    expect(screen.getByRole("link", { name: raceEntry.back })).toHaveAttribute("href", `/${lang}/race/settings`);
    expect(mocks.startSolo).not.toHaveBeenCalled();
  });

  it("uses the race title for valid settings metadata", async () => {
    const { raceEntry, site } = getDictionary("en");
    expect(await generateMetadata(props("en"))).toEqual({ title: `${raceEntry.title} | ${site.name}` });
  });

  it("asks a visitor for a guest nickname and preserves the race destination", async () => {
    mocks.user.mockResolvedValue(null);
    const settings = { ...DEFAULT_RACE_SETTINGS, bots: [] };
    render(await RacePage(props("fr", JSON.stringify(settings))));
    expect(screen.getByLabelText(getDictionary("fr").guest.pseudoLabel)).toBeInTheDocument();
    expect(document.querySelector('input[name="returnTo"]')).toHaveValue(`/fr/race?${serializeRaceSettings(settings)}`);
    expect(mocks.startSolo).not.toHaveBeenCalled();
  });

  it.each(["member", "guest"])("starts once in StrictMode and redirects a %s", async (kind) => {
    mocks.user.mockResolvedValue({ id: "user-1", kind });
    render(<StrictMode>{await RacePage(props())}</StrictMode>);
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/fr/room/ABC234"));
    expect(mocks.startSolo).toHaveBeenCalledTimes(1);
    expect(mocks.startSolo).toHaveBeenCalledWith(toSoloConfig(DEFAULT_RACE_SETTINGS));
  });

  it("waits for the connection and starts once across reconnects", async () => {
    const dictionary = getDictionary("fr");
    const entry = () => <SoloRaceEntry locale="fr" userId="user-1" settings={DEFAULT_RACE_SETTINGS} labels={dictionary.raceEntry} roomLabels={dictionary.room} />;
    mocks.connection = "connecting";
    const { rerender } = render(<StrictMode>{entry()}</StrictMode>);
    expect(screen.getByText(dictionary.raceEntry.pending)).toBeInTheDocument();
    expect(mocks.startSolo).not.toHaveBeenCalled();
    mocks.connection = "connected";
    rerender(<StrictMode>{entry()}</StrictMode>);
    await waitFor(() => expect(mocks.startSolo).toHaveBeenCalledTimes(1));
    mocks.connection = "reconnecting";
    rerender(<StrictMode>{entry()}</StrictMode>);
    mocks.connection = "connected";
    rerender(<StrictMode>{entry()}</StrictMode>);
    expect(mocks.startSolo).toHaveBeenCalledTimes(1);
  });

  it.each(["offline", "tooManyConnections"] as const)("explains a failed initial connection: %s", async (connection) => {
    mocks.connection = connection;
    const dictionary = getDictionary("fr");
    render(await RacePage(props()));
    expect(screen.getByText(plain(dictionary.room.connection[connection]))).toBeInTheDocument();
    expect(screen.getByRole("link", { name: dictionary.raceEntry.back })).toHaveAttribute("href", `/fr/race/settings?${serializeRaceSettings(DEFAULT_RACE_SETTINGS)}`);
    expect(mocks.startSolo).not.toHaveBeenCalled();
  });

  it("translates a refusal and links back to the selected settings", async () => {
    mocks.startSolo.mockResolvedValue({ ok: false, error: "ALREADY_IN_ROOM" });
    const dictionary = getDictionary("en");
    render(await RacePage(props("en")));
    expect(await screen.findByRole("alert")).toHaveTextContent(dictionary.room.errors.ALREADY_IN_ROOM);
    expect(screen.getByRole("link", { name: dictionary.raceEntry.back })).toHaveAttribute("href", `/en/race/settings?${serializeRaceSettings(DEFAULT_RACE_SETTINGS)}`);
    expect(mocks.replace).not.toHaveBeenCalled();
  });
});
