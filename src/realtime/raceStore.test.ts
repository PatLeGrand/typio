// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createRoomStore } from "./roomStore";

const host = { id: "host", displayName: "Hôte", kind: "member" as const };
const guest = { id: "guest", displayName: "Invité", kind: "guest" as const };

function setup() {
  let now = 1000;
  const store = createRoomStore({ now: () => now, generateSeed: () => 42, generateCode: () => "ABCDEF" });
  store.create(host, { length: "short", timeLimitSeconds: 60 }, "runner", now);
  store.join(guest, "ABCDEF", "runner", now);
  return { store, at: (value: number) => { now = value; } };
}

describe("cycle de course du registre", () => {
  it("utilise la graine injectée et sépare les données publiques de la saisie privée", () => {
    const { store, at } = setup();
    const second = setup().store;
    expect(store.start("guest", "ABCDEF")).toEqual({ ok: false, error: "NOT_HOST" });
    store.start("host", "ABCDEF");
    second.start("host", "ABCDEF");
    expect(store.snapshot("ABCDEF")).toEqual(second.snapshot("ABCDEF"));
    expect(store.get("ABCDEF")).not.toHaveProperty("race");
    at(4000);
    expect(store.input("host", "ABCDEF", ["x"]).ok).toBe(true);
    expect(store.get("ABCDEF")?.status).toBe("racing");
    expect(store.snapshot("ABCDEF")?.runners[0]).not.toHaveProperty("typed");
    const self = store.self("ABCDEF", "host");
    if (!self) throw new Error("Coureur absent");
    self.keystrokes.total = 999;
    expect(store.self("ABCDEF", "host")?.keystrokes.total).toBe(1);
  });

  it("refuse les arrivées au décompte et en course, mais les accepte aux résultats", () => {
    const { store, at } = setup();
    const newcomer = { ...guest, id: "new" };
    store.start("host", "ABCDEF");
    expect(store.join(newcomer, "ABCDEF", "runner", 1000)).toEqual({ ok: false, error: "RACE_IN_PROGRESS" });
    at(4000);
    store.tick("ABCDEF");
    expect(store.join(newcomer, "ABCDEF", "spectator", 4000)).toEqual({ ok: false, error: "RACE_IN_PROGRESS" });
    at(64_000);
    expect(store.tick("ABCDEF")?.status).toBe("results");
    expect(store.results("ABCDEF")?.length).toBe(2);
    expect(store.join(newcomer, "ABCDEF", "runner", 64_000).ok).toBe(true);
    expect(store.finish("guest", "ABCDEF", false)).toEqual({ ok: false, error: "NOT_HOST" });
    expect(store.finish("host", "ABCDEF", false).ok).toBe(true);
    expect(store.get("ABCDEF")?.status).toBe("waiting");
    expect(store.get("ABCDEF")?.participants.length).toBe(3);
    expect(store.snapshot("ABCDEF")).toBeNull();
    expect(store.updateConfig("host", "ABCDEF", { botCount: 1 }).ok).toBe(true);
  });

  it("préserve la reprise puis abandonne le déconnecté à l’expiration", () => {
    const { store, at } = setup();
    store.start("host", "ABCDEF");
    at(4000);
    store.input("guest", "ABCDEF", ["x"]);
    store.disconnect("guest", "ABCDEF");
    expect(store.snapshot("ABCDEF")?.runners[1].connected).toBe(false);
    at(5000);
    store.reconnect("guest", "ABCDEF");
    expect(store.self("ABCDEF", "guest")?.typed).toBe("x");
    expect(store.get("ABCDEF")?.participants.length).toBe(2);
    store.disconnect("guest", "ABCDEF");
    at(35_000);
    store.expire("guest", "ABCDEF");
    expect(store.snapshot("ABCDEF")?.runners[1].status).toBe("abandoned");
    store.abandon("host", "ABCDEF");
    expect(store.get("ABCDEF")?.status).toBe("results");
    expect(store.results("ABCDEF")?.length).toBe(2);
    expect(store.finish("host", "ABCDEF", true).ok).toBe(true);
    expect(store.roomOf("host")).toBeNull();
    expect(store.get("ABCDEF")).toBeNull();
    expect(store.create(host, {}, "runner", 35_000).ok).toBe(true);
  });
});
