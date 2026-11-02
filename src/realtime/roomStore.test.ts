import { describe, it, expect, beforeEach } from "vitest";
import { createRoomStore, MAX_SPECTATORS } from "./roomStore";
import { DEFAULT_ROOM_CONFIG, DEFAULT_CAPACITY } from "./protocol";

describe("roomStore bot capacity", () => {
  const host = { id: "host", displayName: "Host", kind: "member" as const };
  const nextRunner = { id: "next-runner", displayName: "Next runner", kind: "guest" as const };

  it("rejects an update whose bots exceed the remaining runner capacity", () => {
    const store = createRoomStore();
    const createRes = store.create(host, {}, "runner", 100);
    if (!createRes.ok) throw new Error("failed to create");
    const code = createRes.state.code;

    for (let index = 0; index < 17; index++) {
      expect(store.join(
        { id: `runner-${index}`, displayName: `Runner ${index}`, kind: "guest" },
        code,
        "runner",
        100
      ).ok).toBe(true);
    }

    expect(store.updateConfig(host.id, code, { bots: ["intermediate", "intermediate", "intermediate"] })).toEqual({ ok: false, error: "ROOM_FULL" });
    expect(store.get(code)?.config.bots).toHaveLength(0);
    expect(store.updateConfig(host.id, code, { bots: ["intermediate", "intermediate"] }).ok).toBe(true);
    expect(store.updateConfig(host.id, code, { bots: ["expert"] }).ok).toBe(true);
    expect(store.get(code)?.config.bots).toEqual(["expert"]);
  });

  it("reserves runner places for bots while spectators can still join", () => {
    const store = createRoomStore();
    const createRes = store.create(host, { bots: ["intermediate", "intermediate", "intermediate", "intermediate", "intermediate"] }, "runner", 100);
    if (!createRes.ok) throw new Error("failed to create");
    const code = createRes.state.code;

    for (let index = 0; index < 14; index++) {
      expect(store.join(
        { id: `runner-${index}`, displayName: `Runner ${index}`, kind: "guest" },
        code,
        "runner",
        100
      ).ok).toBe(true);
    }

    expect(store.join(nextRunner, code, "runner", 100)).toEqual({ ok: false, error: "ROOM_FULL" });
    expect(store.join(nextRunner, code, "spectator", 100).ok).toBe(true);
  });
});

describe("roomStore", () => {
  let store: ReturnType<typeof createRoomStore>;

  beforeEach(() => {
    store = createRoomStore();
  });

  const member = { id: "m1", displayName: "Member 1", kind: "member" as const };
  const member2 = { id: "m2", displayName: "Member 2", kind: "member" as const };
  const guest = { id: "g1", displayName: "Guest 1", kind: "guest" as const };

  it("AC-1: Un membre crée une salle avec un patch de configuration", () => {
    const res = store.create(member, { textMode: "words" }, "runner", 100);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.state.code).toMatch(/^[A-Z0-9]{6}$/);
    expect(res.state.status).toBe("waiting");
    expect(res.state.hostId).toBe(member.id);
    expect(res.state.config.textMode).toBe("words");
    expect(res.state.config.language).toBe(DEFAULT_ROOM_CONFIG.language);
    expect(res.state.participants).toHaveLength(1);
    expect(res.state.participants[0]).toMatchObject({
      userId: member.id,
      role: "runner",
      connected: true,
      joinedAt: 100,
    });
  });

  it("SALLE-01: a spectator host counts toward spectators, not runners or bots", () => {
    const res = store.create(member, { bots: ["intermediate", "intermediate", "intermediate", "intermediate", "intermediate"] }, "spectator", 100);
    if (!res.ok) throw new Error("failed to create");
    const { code } = res.state;
    expect(res.state.hostId).toBe(member.id);
    expect(res.state.participants).toEqual([
      expect.objectContaining({ userId: member.id, role: "spectator", joinedAt: 100 }),
    ]);
    expect(store.get(code)?.participants[0].role).toBe("spectator");

    for (let i = 0; i < DEFAULT_CAPACITY - 5; i++) {
      expect(store.join({ id: `r${i}`, displayName: `R${i}`, kind: "guest" }, code, "runner", 200).ok).toBe(true);
    }
    expect(store.join(guest, code, "runner", 200)).toEqual({ ok: false, error: "ROOM_FULL" });
    expect(store.updateConfig(member.id, code, { bots: ["intermediate", "intermediate", "intermediate", "intermediate", "intermediate", "intermediate"] })).toEqual({ ok: false, error: "ROOM_FULL" });
    expect(store.updateConfig(member.id, code, { bots: ["intermediate", "intermediate", "intermediate", "intermediate", "intermediate"] }).ok).toBe(true);

    for (let i = 0; i < MAX_SPECTATORS - 1; i++) {
      expect(store.join({ id: `s${i}`, displayName: `S${i}`, kind: "guest" }, code, "spectator", 200).ok).toBe(true);
    }
    expect(store.join(guest, code, "spectator", 200)).toEqual({ ok: false, error: "ROOM_FULL" });
  });

  it("AC-2: Un invité ne peut pas créer de salle", () => {
    const res = store.create(guest, {}, "runner", 100);
    expect(res).toEqual({ ok: false, error: "GUEST_CANNOT_CREATE" });
  });

  it("AC-3: Un autre utilisateur rejoint comme runner ou spectator", () => {
    const createRes = store.create(member, {}, "runner", 100);
    if (!createRes.ok) throw new Error("failed to create");

    const joinRes = store.join(guest, createRes.state.code, "spectator", 200);
    expect(joinRes.ok).toBe(true);
    if (!joinRes.ok) return;

    expect(joinRes.state.participants).toHaveLength(2);
    expect(joinRes.state.participants[1]).toMatchObject({
      userId: guest.id,
      role: "spectator",
      joinedAt: 200,
    });
  });

  it("AC-4: Code inconnu retourne ROOM_NOT_FOUND", () => {
    const res = store.join(member, "XYZ123", "runner", 100);
    expect(res).toEqual({ ok: false, error: "ROOM_NOT_FOUND" });
  });

  it("AC-5: Le 21e coureur obtient ROOM_FULL, mais peut être spectateur", () => {
    const createRes = store.create(member, {}, "runner", 100);
    if (!createRes.ok) throw new Error("failed to create");
    const code = createRes.state.code;

    // Ajouter 19 runners (pour faire 20 au total avec l'hôte)
    for (let i = 0; i < DEFAULT_CAPACITY - 1; i++) {
      store.join({ id: `r${i}`, displayName: `R${i}`, kind: "guest" }, code, "runner", 100);
    }

    // Le 21ème
    const fullRes = store.join(member2, code, "runner", 100);
    expect(fullRes).toEqual({ ok: false, error: "ROOM_FULL" });

    const specRes = store.join(member2, code, "spectator", 100);
    expect(specRes.ok).toBe(true);
  });

  it("AC-6: Impossible de rejoindre une AUTRE salle, mais rejoindre la MEME est idempotent", () => {
    const createRes = store.create(member, {}, "runner", 100);
    if (!createRes.ok) throw new Error("failed");
    const code1 = createRes.state.code;

    const createRes2 = store.create(member2, {}, "runner", 100);
    if (!createRes2.ok) throw new Error("failed");
    const code2 = createRes2.state.code;

    // m1 essaie de rejoindre code2
    const failRes = store.join(member, code2, "runner", 200);
    expect(failRes).toEqual({ ok: false, error: "ALREADY_IN_ROOM" });

    // m1 essaie de rejoindre code1 (la même)
    store.disconnect(member.id, code1);
    const successRes = store.join(member, code1, "spectator", 300); // le rôle ne change pas
    expect(successRes.ok).toBe(true);
    if (successRes.ok) {
      const p = successRes.state.participants.find(p => p.userId === member.id);
      expect(p?.connected).toBe(true);
      expect(p?.role).toBe("runner"); // original role
    }
  });

  it.each([
    ["enter", 2], ["enter", null], ["enter", undefined],
    ["reconnect", 2], ["reconnect", null], ["reconnect", undefined],
  ] as const)("H-40: %s refreshes participant and race avatarVersion to %s", (method, avatarVersion) => {
    let now = 100;
    store = createRoomStore({ now: () => now, generateSeed: () => 42 });
    const created = store.create({ ...member, avatarVersion: 1 }, {}, "runner", now);
    if (!created.ok) throw new Error("failed to create");
    const code = created.state.code;
    expect(store.join(member2, code, "runner", now).ok).toBe(true);
    expect(store.start(member.id, code).ok).toBe(true);
    now = 4000;
    store.disconnect(member.id, code);

    const res = method === "enter"
      ? store.join({ ...member, avatarVersion }, code, "runner", now)
      : store.reconnect(member.id, code, avatarVersion);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.state.participants.find((p) => p.userId === member.id)?.avatarVersion).toBe(avatarVersion ?? null);
    expect(store.snapshot(code)?.runners.find((r) => r.id === member.id)?.avatarVersion).toBe(avatarVersion ?? null);
  });

  it("AC-7: Seul l'hôte peut modifier la configuration", () => {
    const createRes = store.create(member, {}, "runner", 100);
    if (!createRes.ok) throw new Error();
    const code = createRes.state.code;
    store.join(guest, code, "runner", 200);

    const failRes = store.updateConfig(guest.id, code, { language: "en" });
    expect(failRes).toEqual({ ok: false, error: "NOT_HOST" });

    const notInRoomRes = store.updateConfig("unknown", code, { language: "en" });
    expect(notInRoomRes).toEqual({ ok: false, error: "NOT_IN_ROOM" });

    const successRes = store.updateConfig(member.id, code, { language: "en" });
    expect(successRes.ok).toBe(true);
    if (successRes.ok) {
      expect(successRes.state.config.language).toBe("en");
    }
  });

  it("AC-8: L'hôte part, le rôle passe au plus ancien connecté. Le dernier supprime la salle.", () => {
    const createRes = store.create(member, {}, "runner", 100);
    if (!createRes.ok) throw new Error();
    const code = createRes.state.code;
    store.join(member2, code, "runner", 200);
    store.join(guest, code, "runner", 300);

    store.disconnect(member2.id, code);

    // member (host) part. L'hôte doit devenir guest, car member2 est déconnecté.
    const leaveRes = store.leave(member.id, code);
    expect(leaveRes.ok).toBe(true);
    if (leaveRes.ok) {
      expect(leaveRes.state.hostId).toBe(guest.id);
    }

    // Tous partent
    store.leave(guest.id, code);
    const lastRes = store.leave(member2.id, code);
    expect(lastRes.ok).toBe(true);
    expect(store.get(code)).toBeNull(); // La salle est supprimée
  });

  it("SALLE-01: a spectator host leaves without changing the remaining participants' roles", () => {
    const createRes = store.create(member, {}, "spectator", 100);
    if (!createRes.ok) throw new Error("failed to create");
    const code = createRes.state.code;
    expect(store.join(guest, code, "spectator", 200).ok).toBe(true);
    expect(store.join(member2, code, "runner", 300).ok).toBe(true);

    const leaveRes = store.leave(member.id, code);
    expect(leaveRes.ok).toBe(true);
    if (!leaveRes.ok) return;

    expect(leaveRes.state.hostId).toBe(guest.id);
    expect(leaveRes.state.participants).toEqual([
      expect.objectContaining({ userId: guest.id, role: "spectator", connected: true }),
      expect.objectContaining({ userId: member2.id, role: "runner", connected: true }),
    ]);
  });

  it("AC-9: Disconnect ne retire personne et ne transfère pas le rôle", () => {
    const createRes = store.create(member, {}, "runner", 100);
    if (!createRes.ok) throw new Error();
    const code = createRes.state.code;
    store.join(member2, code, "runner", 200);

    const disRes = store.disconnect(member.id, code);
    expect(disRes.ok).toBe(true);
    if (disRes.ok) {
      const host = disRes.state.participants.find(p => p.userId === member.id);
      expect(host?.connected).toBe(false);
      expect(disRes.state.hostId).toBe(member.id); // toujours hôte
    }
  });

  it("AC-11: Les états rendus sont des copies", () => {
    const createRes = store.create(member, {}, "runner", 100);
    if (!createRes.ok) throw new Error();
    const state = createRes.state;

    // Tentative de mutation
    state.config.language = "en";
    state.participants[0].role = "spectator";

    const getRes = store.get(state.code);
    expect(getRes?.config.language).toBe("fr"); // Toujours par défaut
    expect(getRes?.participants[0].role).toBe("runner"); // Toujours runner
  });

  it("AC-10: Le code d'une nouvelle salle n'est jamais celui d'une salle ouverte", () => {
    // Le générateur propose d'abord un code déjà pris, puis un libre.
    const candidates = ["AAAAAA", "AAAAAA", "BBBBBB"];
    const seeded = createRoomStore({ generateCode: () => candidates.shift() ?? "CCCCCC" });

    const first = seeded.create(member, {}, "runner", 100);
    const second = seeded.create(member2, {}, "runner", 100);
    if (!first.ok || !second.ok) throw new Error("failed to create");

    expect(first.state.code).toBe("AAAAAA");
    expect(second.state.code).toBe("BBBBBB");
  });

  it("AC-10: Le code d'une salle supprimée peut être réattribué", () => {
    const seeded = createRoomStore({ generateCode: () => "AAAAAA" });
    const first = seeded.create(member, {}, "runner", 100);
    if (!first.ok) throw new Error("failed to create");
    seeded.leave(member.id, "AAAAAA");

    const second = seeded.create(member2, {}, "runner", 100);
    expect(second.ok && second.state.code).toBe("AAAAAA");
  });

  it("roomOf: rend la salle de l'utilisateur, null sinon et après son départ", () => {
    const createRes = store.create(member, {}, "runner", 100);
    if (!createRes.ok) throw new Error("failed to create");
    const code = createRes.state.code;

    expect(store.roomOf(member.id)).toBe(code);
    expect(store.roomOf(guest.id)).toBeNull();

    store.leave(member.id, code);
    expect(store.roomOf(member.id)).toBeNull();
  });

  it("CONFIG_LOCKED: la config ne change plus hors de l'état waiting", () => {
    const createRes = store.create(member, {}, "runner", 100);
    if (!createRes.ok) throw new Error("failed to create");
    const code = createRes.state.code;

    store.setStatus(code, "racing");
    expect(store.updateConfig(member.id, code, { language: "en" })).toEqual({
      ok: false,
      error: "CONFIG_LOCKED",
    });
    expect(store.get(code)?.config.language).toBe(DEFAULT_ROOM_CONFIG.language);

    store.setStatus(code, "waiting");
    expect(store.updateConfig(member.id, code, { language: "en" }).ok).toBe(true);
  });

  it("CONFIG_LOCKED: un non-hôte reçoit NOT_HOST avant CONFIG_LOCKED", () => {
    const createRes = store.create(member, {}, "runner", 100);
    if (!createRes.ok) throw new Error("failed to create");
    store.join(guest, createRes.state.code, "runner", 200);
    store.setStatus(createRes.state.code, "racing");

    expect(store.updateConfig(guest.id, createRes.state.code, { language: "en" })).toEqual({
      ok: false,
      error: "NOT_HOST",
    });
  });

  it("expire: retire un participant déconnecté et transfère l'hôte (ancien SALLE-13, SALLE-08)", () => {
    const createRes = store.create(member, {}, "runner", 100);
    if (!createRes.ok) throw new Error("failed to create");
    const code = createRes.state.code;
    store.join(guest, code, "runner", 200);

    store.disconnect(member.id, code);
    const res = store.expire(member.id, code);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.state.hostId).toBe(guest.id);
      expect(res.state.participants.map((p) => p.userId)).toEqual([guest.id]);
    }
    expect(store.roomOf(member.id)).toBeNull();
  });

  it("reconnect: repasse connected à true et conserve joinedAt", () => {
    const createRes = store.create(member, {}, "runner", 100);
    if (!createRes.ok) throw new Error("failed to create");
    const code = createRes.state.code;

    store.disconnect(member.id, code);
    const res = store.reconnect(member.id, code);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.state.participants[0]).toMatchObject({ connected: true, joinedAt: 100 });
    }
    expect(store.reconnect("unknown", code)).toEqual({ ok: false, error: "NOT_IN_ROOM" });
  });

  it("MAX_SPECTATORS: le 21e spectateur obtient ROOM_FULL, un coureur peut encore entrer", () => {
    const createRes = store.create(member, {}, "runner", 100);
    if (!createRes.ok) throw new Error("failed to create");
    const code = createRes.state.code;

    for (let i = 0; i < MAX_SPECTATORS; i++) {
      const res = store.join({ id: `s${i}`, displayName: `S${i}`, kind: "guest" }, code, "spectator", 100);
      expect(res.ok).toBe(true);
    }

    expect(store.join(member2, code, "spectator", 100)).toEqual({ ok: false, error: "ROOM_FULL" });
    expect(store.roomOf(member2.id)).toBeNull();
    expect(store.join(member2, code, "runner", 100).ok).toBe(true);
  });

  it("l'index utilisateur vers salle suit create, join, leave et expire", () => {
    const createRes = store.create(member, {}, "runner", 100);
    if (!createRes.ok) throw new Error("failed to create");
    const code = createRes.state.code;

    store.join(guest, code, "runner", 200);
    expect(store.roomOf(guest.id)).toBe(code);

    store.join(member2, "ABCDEF", "runner", 300); // salle inconnue : aucun effet
    expect(store.roomOf(member2.id)).toBeNull();

    store.expire(guest.id, code);
    expect(store.roomOf(guest.id)).toBeNull();

    store.leave(member.id, code);
    expect(store.roomOf(member.id)).toBeNull();
    expect(store.create(member, {}, "runner", 400).ok).toBe(true);
  });
});

describe("roomStore visibilité et capacité (SALLE-03, SALLE-05)", () => {
  const host = { id: "host", displayName: "Host", kind: "member" as const };
  const other = { id: "other", displayName: "Other", kind: "guest" as const };

  it("refuse le code seul sur une salle privée, sauf à qui y est déjà", () => {
    const store = createRoomStore();
    const res = store.create(host, { visibility: "private" }, "runner", 100);
    if (!res.ok) throw new Error("failed to create");
    expect(store.join(other, res.state.code, "runner", 200)).toEqual({ ok: false, error: "INVITE_REQUIRED" });
    expect(store.join(host, res.state.code, "runner", 200).ok).toBe(true);
    store.updateConfig(host.id, res.state.code, { visibility: "code" });
    expect(store.join(other, res.state.code, "runner", 200).ok).toBe(true);
  });

  it("applique la capacité configurée aux coureurs, bots compris, pas aux spectateurs", () => {
    const store = createRoomStore();
    const res = store.create(host, { capacity: 3, bots: ["intermediate"] }, "runner", 100);
    if (!res.ok) throw new Error("failed to create");
    const { code } = res.state;
    expect(store.join(other, code, "runner", 200).ok).toBe(true);
    expect(store.join({ id: "third", displayName: "Third", kind: "guest" }, code, "runner", 200))
      .toEqual({ ok: false, error: "ROOM_FULL" });
    expect(store.join({ id: "watcher", displayName: "Watcher", kind: "guest" }, code, "spectator", 200).ok).toBe(true);
  });

  it("refuse une capacité sous les coureurs et bots présents, ou des bots au-delà", () => {
    const store = createRoomStore();
    const res = store.create(host, { bots: ["intermediate", "intermediate"] }, "runner", 100);
    if (!res.ok) throw new Error("failed to create");
    const { code } = res.state;
    store.join(other, code, "runner", 200);
    expect(store.updateConfig(host.id, code, { capacity: 3 })).toEqual({ ok: false, error: "ROOM_FULL" });
    expect(store.updateConfig(host.id, code, { bots: ["intermediate", "intermediate", "intermediate", "intermediate"], capacity: 5 })).toEqual({ ok: false, error: "ROOM_FULL" });
    expect(store.updateConfig(host.id, code, { capacity: 4 }).ok).toBe(true);
    expect(store.updateConfig(host.id, code, { bots: ["intermediate", "intermediate", "intermediate"] })).toEqual({ ok: false, error: "ROOM_FULL" });
    expect(store.create({ ...host, id: "h2" }, { capacity: 2, bots: ["intermediate", "intermediate"] }, "runner", 300))
      .toEqual({ ok: false, error: "ROOM_FULL" });
  });
});
