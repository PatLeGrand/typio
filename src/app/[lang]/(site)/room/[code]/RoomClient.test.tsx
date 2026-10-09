import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/auth/types";
import { getDictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { DEFAULT_ROOM_CONFIG, MAX_RUNNERS, type Participant, type RoomState } from "@/realtime/protocol";

const mocks = vi.hoisted(() => ({
  state: null as RoomState | null,
  join: vi.fn(),
  leave: vi.fn(),
  updateConfig: vi.fn(),
  push: vi.fn(),
}));

vi.mock("@/realtime/useRoom", () => ({
  useRoom: () => ({
    state: mocks.state,
    error: null,
    join: mocks.join,
    leave: mocks.leave,
    updateConfig: mocks.updateConfig,
  }),
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: mocks.push }),
}));

import { RoomClient } from "./RoomClient";

const VIEWER: CurrentUser = {
  id: "viewer",
  kind: "member",
  displayName: "Viewer",
  username: "viewer",
  locale: "fr",
};

function participant(overrides: Partial<Participant> & Pick<Participant, "userId" | "displayName">): Participant {
  return { kind: "member", role: "runner", connected: true, joinedAt: 0, ...overrides };
}

function roomState(participants: Participant[]): RoomState {
  return {
    code: "ABCD",
    status: "waiting",
    hostId: "host",
    config: DEFAULT_ROOM_CONFIG,
    participants,
    maxRunners: MAX_RUNNERS,
  };
}

function renderRoom(participants: Participant[], lang: Locale = "fr") {
  mocks.state = roomState(participants);
  return render(<RoomClient code="ABCD" lang={lang} dict={getDictionary(lang)} user={VIEWER} />);
}

/** Retrouve le `listitem` d'un participant par son nom affiché (le premier qui le contient). */
function itemOf(name: string, index = 0): HTMLElement {
  return screen.getAllByRole("listitem").filter((li) => li.textContent?.includes(name))[index];
}

beforeEach(() => {
  mocks.join.mockReset().mockResolvedValue(undefined);
  mocks.state = null;
});

describe("RoomClient — badge Invité (AUTH-4)", () => {
  it("affiche le badge « Invité » dans le listitem d'un participant invité", () => {
    renderRoom([participant({ userId: "g1", displayName: "Zoé", kind: "guest" })]);

    expect(within(itemOf("Zoé")).getByText("Invité")).toBeInTheDocument();
  });

  it("n'affiche aucun badge invité pour un membre", () => {
    renderRoom([participant({ userId: "m1", displayName: "Alice", kind: "member" })]);

    expect(within(itemOf("Alice")).queryByText("Invité")).not.toBeInTheDocument();
  });

  it("affiche « Guest » avec le dictionnaire anglais", () => {
    renderRoom([participant({ userId: "g1", displayName: "Zoe", kind: "guest" })], "en");

    expect(within(itemOf("Zoe")).getByText("Guest")).toBeInTheDocument();
    expect(within(itemOf("Zoe")).queryByText("Invité")).not.toBeInTheDocument();
  });

  it("distingue un membre et un invité qui portent le même nom affiché", () => {
    renderRoom([
      participant({ userId: "m1", displayName: "Lili", kind: "member" }),
      participant({ userId: "g1", displayName: "Lili", kind: "guest" }),
    ]);

    const items = screen.getAllByRole("listitem").filter((li) => li.textContent?.includes("Lili"));
    expect(items).toHaveLength(2);
    const [memberItem, guestItem] = items;
    expect(within(memberItem).queryByText("Invité")).not.toBeInTheDocument();
    expect(within(guestItem).getByText("Invité")).toBeInTheDocument();
    expect(guestItem.textContent).toContain("Invité");
    expect(memberItem.textContent).not.toContain("Invité");
  });

  it("garde le badge lisible par les technologies d'assistance et sur les tokens du thème", () => {
    renderRoom([participant({ userId: "g1", displayName: "Zoé", kind: "guest" })]);

    const badge = within(itemOf("Zoé")).getByText("Invité");
    expect(badge.closest('[aria-hidden="true"]')).toBeNull();
    expect(badge).toHaveClass("text-muted-strong", "border", "border-border");
    expect(badge.className).not.toMatch(/#|\b(?:text|bg|border)-(?:gray|slate|zinc|red|green|blue)-\d/);
  });

  it("affiche les badges Invité et Spectateur pour un invité spectateur", () => {
    renderRoom([participant({ userId: "g1", displayName: "Zoé", kind: "guest", role: "spectator" })]);

    const item = itemOf("Zoé");
    expect(within(item).getByText("Invité")).toBeInTheDocument();
    expect(within(item).getByText("Spectateur")).toBeInTheDocument();
  });
});
