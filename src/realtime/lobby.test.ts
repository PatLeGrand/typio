import { describe, expect, it } from "vitest";
import { lobbyRooms, pickQuickJoin, toLobbyEntry, type LobbyEntry } from "./lobby";
import { DEFAULT_ROOM_CONFIG, LOBBY_MAX_ROOMS, type LobbyRoom, type RoomConfig } from "./protocol";
import { createRoomStore } from "./roomStore";

function entry(code: string, createdAt: number, overrides: Partial<LobbyRoom> = {}): LobbyEntry {
  return {
    createdAt,
    room: { code, runners: 1, capacity: 20, language: "fr", host: "Host", status: "waiting", joinable: true, ...overrides },
  };
}

describe("pickQuickJoin (JOIN-03)", () => {
  it("choisit la salle qui a le moins de places libres", () => {
    const picked = pickQuickJoin([
      entry("AAAAAA", 1, { runners: 5, capacity: 20 }),
      entry("BBBBBB", 2, { runners: 7, capacity: 8 }),
      entry("CCCCCC", 3, { runners: 2, capacity: 4 }),
    ]);
    expect(picked?.room.code).toBe("BBBBBB");
  });

  it("départage à égalité de places libres par la plus ancienne", () => {
    const picked = pickQuickJoin([
      entry("AAAAAA", 30, { runners: 3, capacity: 5 }),
      entry("BBBBBB", 10, { runners: 8, capacity: 10 }),
      entry("CCCCCC", 20, { runners: 1, capacity: 3 }),
    ]);
    expect(picked?.room.code).toBe("BBBBBB");
  });

  it("ignore les salles non joignables (pleines, en course) et renvoie null s'il n'en reste aucune", () => {
    expect(pickQuickJoin([
      entry("AAAAAA", 1, { runners: 5, capacity: 5, joinable: false }),
      entry("BBBBBB", 2, { runners: 3, capacity: 5, status: "racing", joinable: false }),
    ])).toBeNull();
    expect(pickQuickJoin([])).toBeNull();
  });
});

describe("explorateur (JOIN-02, SALLE-03)", () => {
  const host = { id: "host", displayName: "Hôte", kind: "member" as const };
  const codes = ["AAAAAA", "BBBBBB", "CCCCCC", "DDDDDD"];

  function storeWith(visibilities: RoomConfig["visibility"][]) {
    let index = 0;
    const store = createRoomStore({ generateCode: () => codes[index++] });
    visibilities.forEach((visibility, i) => {
      store.create({ ...host, id: `host-${i}` }, { visibility, botCount: 1 }, "runner", 100 + i);
    });
    return store;
  }

  it("n'expose que les salles publiques, avec bots comptés dans les coureurs", () => {
    const store = storeWith(["code", "public", "private", "public"]);
    expect(store.lobby()).toEqual([
      { code: "BBBBBB", runners: 2, capacity: DEFAULT_ROOM_CONFIG.capacity, language: "fr", host: "Hôte", status: "waiting", joinable: true },
      { code: "DDDDDD", runners: 2, capacity: DEFAULT_ROOM_CONFIG.capacity, language: "fr", host: "Hôte", status: "waiting", joinable: true },
    ]);
  });

  it("marque une salle en course ou pleine comme non joignable, et omet une salle fermée", () => {
    const store = storeWith(["public", "public"]);
    store.setStatus("AAAAAA", "racing");
    store.updateConfig("host-1", "BBBBBB", { capacity: 2 });
    expect(store.lobby().map((room) => [room.code, room.joinable])).toEqual([["AAAAAA", false], ["BBBBBB", false]]);
    expect(store.quickJoinCode()).toBeNull();
    expect(toLobbyEntry({ ...store.get("AAAAAA")!, status: "closed" }, 1)).toBeNull();
  });

  it("plafonne la liste", () => {
    const entries = Array.from({ length: LOBBY_MAX_ROOMS + 5 }, (_, i) => entry(`R${i}`, i));
    expect(lobbyRooms(entries)).toHaveLength(LOBBY_MAX_ROOMS);
  });
});
