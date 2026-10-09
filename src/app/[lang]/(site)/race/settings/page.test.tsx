import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/auth/types";
import { makeUseRoom, ME } from "@/test/roomFixtures";
import RaceSettingsPage from "./page";
import { DEFAULT_RACE_SETTINGS } from "@/race/config";
import fr from "@/i18n/dictionaries/fr.json";

const mocks = vi.hoisted(() => ({ getCurrentUser: vi.fn<() => Promise<CurrentUser | null>>() }));

vi.mock("@/auth/currentUser", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/realtime/useRoom", () => ({ useRoom: () => makeUseRoom() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const user: CurrentUser = { id: ME, kind: "member", displayName: "Alice", username: "alice", locale: "fr" };

beforeEach(() => {
  mocks.getCurrentUser.mockResolvedValue(null);
});

const copy = fr.raceSettings;

async function renderPage(config: string | string[] | undefined) {
  render(await RaceSettingsPage({ params: Promise.resolve({ lang: "fr" }), searchParams: Promise.resolve({ config }) }));
}

describe("race settings page", () => {
  it("starts from the defaults without a config", async () => {
    await renderPage(undefined);
    expect(screen.getByRole("radio", { name: copy.timeLimit.none })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Phrases" })).toHaveAttribute("aria-checked", "true");
  });

  it("pre-fills the choices from a valid ?config= (back from a race)", async () => {
    await renderPage(JSON.stringify({ ...DEFAULT_RACE_SETTINGS, textMode: "words", timeLimitSeconds: 120 }));
    expect(screen.getByRole("radio", { name: "Mots" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "2 min" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: copy.timeLimit.none })).toHaveAttribute("aria-checked", "false");
  });

  it("falls back to the defaults for an invalid config", async () => {
    await renderPage("{not json");
    expect(screen.getByRole("radio", { name: copy.timeLimit.none })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Phrases" })).toHaveAttribute("aria-checked", "true");
  });

  it("is open to visitors: invite disabled with a login link, solo race available", async () => {
    await renderPage(undefined);
    expect(screen.getByRole("button", { name: copy.invite.button })).toBeDisabled();
    expect(screen.getByRole("link", { name: copy.invite.loginLink })).toHaveAttribute("href", "/fr/login");
    expect(screen.getByRole("button", { name: /Lancer la course/ })).toBeEnabled();
  });

  it("guest: invite disabled with the guest reason, solo race still available", async () => {
    mocks.getCurrentUser.mockResolvedValue({ ...user, kind: "guest" });
    await renderPage(undefined);
    expect(screen.getByRole("button", { name: copy.invite.button })).toHaveAccessibleDescription(copy.invite.guestNotice);
    expect(screen.getByRole("button", { name: /Lancer la course/ })).toBeEnabled();
  });

  it("member: invite enabled", async () => {
    mocks.getCurrentUser.mockResolvedValue(user);
    await renderPage(undefined);
    expect(screen.getByRole("button", { name: copy.invite.button })).toBeEnabled();
  });
});
