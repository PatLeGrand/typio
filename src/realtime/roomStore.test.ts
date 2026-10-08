import { describe, it, expect, beforeEach, vi } from "vitest";
import { createRoomStore } from "./roomStore";
import { DEFAULT_ROOM_CONFIG, MAX_RUNNERS } from "./protocol";

describe("roomStore", () => {
  let store: ReturnType<typeof createRoomStore>;

  beforeEach(() => {
    store = createRoomStore();
  });

  const member = { id: "m1", displayName: "Member 1", kind: "member" as const };
  const member2 = { id: "m2", displayName: "Member 2", kind: "member" as const };
  const guest = { id: "g1", displayName: "Guest 1", kind: "guest" as const };

  it("AC-1: Un membre crée une salle avec un patch de configuration", () => {
    const res = store.create(member, { textMode: "words" }, 100);
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

  it("AC-2: Un invité ne peut pas créer de salle", () => {
    const res = store.create(guest, {}, 100);
    expect(res).toEqual({ ok: false, error: "GUEST_CANNOT_CREATE" });
  });

  it("AC-3: Un autre utilisateur rejoint comme runner ou spectator", () => {
    const createRes = store.create(member, {}, 100);
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
    const createRes = store.create(member, {}, 100);
    if (!createRes.ok) throw new Error("failed to create");
    const code = createRes.state.code;

    // Ajouter 19 runners (pour faire 20 au total avec l'hôte)
    for (let i = 0; i < MAX_RUNNERS - 1; i++) {
      store.join({ id: `r${i}`, displayName: `R${i}`, kind: "guest" }, code, "runner", 100);
    }

    // Le 21ème
    const fullRes = store.join(member2, code, "runner", 100);
    expect(fullRes).toEqual({ ok: false, error: "ROOM_FULL" });

    const specRes = store.join(member2, code, "spectator", 100);
    expect(specRes.ok).toBe(true);
  });

  it("AC-6: Impossible de rejoindre une AUTRE salle, mais rejoindre la MEME est idempotent", () => {
    const createRes = store.create(member, {}, 100);
    if (!createRes.ok) throw new Error("failed");
    const code1 = createRes.state.code;

    const createRes2 = store.create(member2, {}, 100);
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

  it("AC-7: Seul l'hôte peut modifier la configuration", () => {
    const createRes = store.create(member, {}, 100);
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
    const createRes = store.create(member, {}, 100);
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

  it("AC-9: Disconnect ne retire personne et ne transfère pas le rôle", () => {
    const createRes = store.create(member, {}, 100);
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
    const createRes = store.create(member, {}, 100);
    if (!createRes.ok) throw new Error();
    const state = createRes.state;

    // Tentative de mutation
    state.config.language = "en";
    state.participants[0].role = "spectator";

    const getRes = store.get(state.code);
    expect(getRes?.config.language).toBe("fr"); // Toujours par défaut
    expect(getRes?.participants[0].role).toBe("runner"); // Toujours runner
  });
});
