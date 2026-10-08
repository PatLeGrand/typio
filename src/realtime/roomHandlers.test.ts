// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import type { Ack, JoinPayload, RoomState } from "./protocol";
import { startTestServer, waitForConnection, type TestClient } from "./testSupport";

type TestServer = Awaited<ReturnType<typeof startTestServer>>;
type CreateAck = Ack<{ code: string }>;

const WAIT_TIMEOUT_MS = 2000;

/** Délai de grâce par défaut des tests : assez long pour ne jamais expirer par accident. */
const LONG_GRACE_MS = 5000;

const servers: TestServer[] = [];

async function start(graceMs = LONG_GRACE_MS): Promise<TestServer> {
  const server = await startTestServer({ graceMs });
  servers.push(server);
  return server;
}

afterEach(async () => {
  for (const server of servers.splice(0)) await server.close();
});

/** Ouvre un socket pour ce jeton et attend sa connexion. */
async function open(server: TestServer, token: string): Promise<TestClient> {
  const socket = server.client(token);
  const result = await waitForConnection(socket);
  if (!result.connected) throw new Error(`socket refused: ${result.error}`);
  return socket;
}

function emitAck<T>(emit: (ack: (res: T) => void) => void): Promise<T> {
  return new Promise((resolve) => emit(resolve));
}

const create = (socket: TestClient, config: unknown = {}) =>
  emitAck<CreateAck>((ack) => socket.emit("room:create", config, ack));

const join = (socket: TestClient, payload: unknown) =>
  emitAck<CreateAck>((ack) => socket.emit("room:join", payload, ack));

const updateConfig = (socket: TestClient, patch: unknown) =>
  emitAck<Ack>((ack) => socket.emit("room:updateConfig", patch, ack));

const leave = (socket: TestClient) => emitAck<Ack>((ack) => socket.emit("room:leave", ack));

function expectOk(ack: CreateAck): string {
  if (!ack.ok) throw new Error(`expected ok, got ${ack.error}`);
  return ack.data.code;
}

/** Attend le premier état qui satisfait la condition. */
function waitForState(socket: TestClient, condition: (s: RoomState) => boolean): Promise<RoomState> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off("room:state", listener);
      reject(new Error("timed out waiting for room:state"));
    }, WAIT_TIMEOUT_MS);
    const listener = (state: RoomState) => {
      if (!condition(state)) return;
      clearTimeout(timer);
      socket.off("room:state", listener);
      resolve(state);
    };
    socket.on("room:state", listener);
  });
}

/** Enregistre tous les états reçus à partir de maintenant. */
function recordStates(socket: TestClient): RoomState[] {
  const received: RoomState[] = [];
  socket.on("room:state", (state) => received.push(state));
  return received;
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const participant = (state: RoomState, userId: string) => state.participants.find((p) => p.userId === userId);

/** A (membre) crée une salle ; B (invité) la rejoint. `joined` est l'état que B reçoit en entrant. */
async function roomWithTwo(server: TestServer) {
  const userA = server.sessions.signIn("member");
  const userB = server.sessions.signIn("guest");
  const socketA = await open(server, userA.token);
  const code = expectOk(await create(socketA));
  const socketB = await open(server, userB.token);
  const entered = waitForState(socketB, (s) => s.participants.length === 2);
  expectOk(await join(socketB, { code, role: "runner" } satisfies JoinPayload));
  const joined = await entered;
  return { userA, userB, socketA, socketB, code, joined };
}

describe("roomHandlers (lot 2)", () => {
  it("AC-1: membre A crée, reçoit le code dans l'accusé et un room:state", async () => {
    const server = await start();
    const userA = server.sessions.signIn("member");
    const socketA = await open(server, userA.token);
    const statePromise = waitForState(socketA, (s) => s.participants.length === 1);

    const code = expectOk(await create(socketA, { textMode: "words" }));

    const state = await statePromise;
    expect(state.code).toBe(code);
    expect(state.hostId).toBe(userA.userId);
    expect(state.config.textMode).toBe("words");
  });

  it("AC-2: invité B rejoint, A et B reçoivent le même room:state à 2 participants", async () => {
    const server = await start();
    const socketA = await open(server, server.sessions.signIn("member").token);
    const code = expectOk(await create(socketA));
    const socketB = await open(server, server.sessions.signIn("guest").token);

    const statePromiseA = waitForState(socketA, (s) => s.participants.length === 2);
    const statePromiseB = waitForState(socketB, (s) => s.participants.length === 2);
    expectOk(await join(socketB, { code, role: "runner" }));

    const [stateA, stateB] = await Promise.all([statePromiseA, statePromiseB]);
    expect(stateA).toEqual(stateB);
  });

  it("AC-2: un code saisi en minuscules avec un tiret est normalisé (SALLE-4)", async () => {
    const server = await start();
    const socketA = await open(server, server.sessions.signIn("member").token);
    const code = expectOk(await create(socketA));
    const socketB = await open(server, server.sessions.signIn("guest").token);

    const typed = `${code.slice(0, 3)}-${code.slice(3)}`.toLowerCase();
    expect(expectOk(await join(socketB, { code: typed, role: "spectator" }))).toBe(code);
  });

  it("AC-3 (SALLE-10): A change la langue, B reçoit le room:state sans rien demander", async () => {
    const server = await start();
    const { socketA, socketB } = await roomWithTwo(server);
    const statePromiseB = waitForState(socketB, (s) => s.config.language === "en");

    expect(await updateConfig(socketA, { language: "en" })).toEqual({ ok: true });

    expect((await statePromiseB).config.language).toBe("en");
  });

  it("AC-4: B tente updateConfig, accusé NOT_HOST et aucune diffusion", async () => {
    const server = await start();
    const { socketA, socketB } = await roomWithTwo(server);
    await pause(25);
    const seenByA = recordStates(socketA);

    expect(await updateConfig(socketB, { language: "en" })).toEqual({ ok: false, error: "NOT_HOST" });

    await pause(50);
    expect(seenByA).toEqual([]);
  });

  it("AC-5: un invité qui tente room:create reçoit GUEST_CANNOT_CREATE", async () => {
    const server = await start();
    const socketB = await open(server, server.sessions.signIn("guest").token);
    expect(await create(socketB)).toEqual({ ok: false, error: "GUEST_CANNOT_CREATE" });
  });

  it("AC-6: charges utiles invalides", async () => {
    const server = await start();
    const socketA = await open(server, server.sessions.signIn("member").token);

    expect(await create(socketA, { hostId: "x" })).toEqual({ ok: false, error: "INVALID_PAYLOAD" });
    expect(await join(socketA, { code: "abc", role: "runner" })).toEqual({ ok: false, error: "INVALID_CODE" });
    expect(await join(socketA, "ABCDEF")).toEqual({ ok: false, error: "INVALID_PAYLOAD" });
    expect(await updateConfig(socketA, { language: "klingon" })).toEqual({
      ok: false,
      error: "INVALID_PAYLOAD",
    });
  });

  it("code inconnu: ROOM_NOT_FOUND", async () => {
    const server = await start();
    const socketA = await open(server, server.sessions.signIn("member").token);
    expect(await join(socketA, { code: "ABCDEF", role: "runner" })).toEqual({
      ok: false,
      error: "ROOM_NOT_FOUND",
    });
  });

  it("AC-7 (SALLE-15): A quitte, B reçoit un état où il est hôte", async () => {
    const server = await start();
    const { userB, socketA, socketB } = await roomWithTwo(server);
    const statePromiseB = waitForState(socketB, (s) => s.participants.length === 1);

    expect((await leave(socketA)).ok).toBe(true);

    expect((await statePromiseB).hostId).toBe(userB.userId);
  });

  it("AC-8 (SALLE-13): B se déconnecte, A voit connected: false ; B revient par room:join, même joinedAt", async () => {
    const server = await start();
    const { userB, socketA, socketB, code, joined } = await roomWithTwo(server);
    const joinedAt = participant(joined, userB.userId)?.joinedAt;
    const disconnected = waitForState(socketA, (s) => participant(s, userB.userId)?.connected === false);

    socketB.disconnect();

    const stateOffline = await disconnected;
    expect(stateOffline.participants).toHaveLength(2);
    expect(stateOffline.hostId).toBe(joined.hostId);

    const reconnected = waitForState(socketA, (s) => participant(s, userB.userId)?.connected === true);
    const socketB2 = await open(server, userB.token);
    expectOk(await join(socketB2, { code, role: "runner" }));

    expect(participant(await reconnected, userB.userId)?.joinedAt).toBe(joinedAt);
  });

  it("room:updateConfig et room:leave sans salle: NOT_IN_ROOM", async () => {
    const server = await start();
    const socketA = await open(server, server.sessions.signIn("member").token);
    expect(await updateConfig(socketA, { language: "en" })).toEqual({ ok: false, error: "NOT_IN_ROOM" });
    expect(await leave(socketA)).toEqual({ ok: false, error: "NOT_IN_ROOM" });
  });

  it("ALREADY_IN_ROOM: un membre déjà dans une salle ne peut pas en créer une autre", async () => {
    const server = await start();
    const socketA = await open(server, server.sessions.signIn("member").token);
    expectOk(await create(socketA));
    expect(await create(socketA)).toEqual({ ok: false, error: "ALREADY_IN_ROOM" });
  });
});

describe("roomHandlers: reconnexion, onglets et départ (D1 à D4)", () => {
  it("S-1 (D2): B recharge, son nouveau socket reçoit l'état sans join, connected: true, même joinedAt", async () => {
    const server = await start();
    const { userB, socketA, socketB, joined } = await roomWithTwo(server);
    const joinedAt = participant(joined, userB.userId)?.joinedAt;
    const disconnected = waitForState(socketA, (s) => participant(s, userB.userId)?.connected === false);
    socketB.disconnect();
    await disconnected;

    const reconnectedForA = waitForState(socketA, (s) => participant(s, userB.userId)?.connected === true);
    const socketB2 = server.client(userB.token);
    const stateForB2 = waitForState(socketB2, (s) => s.participants.length === 2);
    await waitForConnection(socketB2);

    const state = await stateForB2;
    expect(participant(state, userB.userId)).toMatchObject({ connected: true, joinedAt });
    expect(participant(await reconnectedForA, userB.userId)?.connected).toBe(true);
    expect(server.timers.size).toBe(0);
  });

  it("S-1 (D2): le nouveau socket reçoit ensuite les diffusions de la salle", async () => {
    const server = await start();
    const { userB, socketA, socketB } = await roomWithTwo(server);
    socketB.disconnect();
    const socketB2 = server.client(userB.token);
    await waitForConnection(socketB2);

    const updated = waitForState(socketB2, (s) => s.config.language === "en");
    expect(await updateConfig(socketA, { language: "en" })).toEqual({ ok: true });
    expect((await updated).config.language).toBe("en");
  });

  it("D2: un utilisateur sans salle qui se connecte ne reçoit aucun état", async () => {
    const server = await start();
    await roomWithTwo(server);
    const stranger = server.client(server.sessions.signIn("guest").token);
    const seen = recordStates(stranger);
    await waitForConnection(stranger);
    await pause(50);
    expect(seen).toEqual([]);
  });

  it("S-2 (D4): B déconnecté au-delà du délai de grâce est retiré et A le voit", async () => {
    const server = await start(100);
    const { userA, userB, socketA, socketB } = await roomWithTwo(server);
    const removed = waitForState(socketA, (s) => !participant(s, userB.userId));

    socketB.disconnect();

    expect((await removed).participants.map((p) => p.userId)).toEqual([userA.userId]);
    expect(server.timers.size).toBe(0);
  });

  it("S-2 (SALLE-15): l'hôte déconnecté qui expire passe le rôle au participant connecté", async () => {
    const server = await start(100);
    const { userA, userB, socketA, socketB } = await roomWithTwo(server);
    const transferred = waitForState(socketB, (s) => !participant(s, userA.userId));

    socketA.disconnect();

    expect((await transferred).hostId).toBe(userB.userId);
  });

  it("S-2: la dernière personne qui expire supprime la salle, son code est libéré", async () => {
    const server = await start(80);
    const userA = server.sessions.signIn("member");
    const socketA = await open(server, userA.token);
    const code = expectOk(await create(socketA));
    socketA.disconnect();
    await pause(250);

    const socketA2 = await open(server, userA.token);
    expect(await join(socketA2, { code, role: "runner" })).toEqual({ ok: false, error: "ROOM_NOT_FOUND" });
    expectOk(await create(socketA2));
  });

  it("S-3: avec deux onglets, en fermer un ne marque pas A déconnecté", async () => {
    const server = await start();
    const { userA, socketB } = await roomWithTwo(server);
    const tab1 = await open(server, userA.token);
    const tab2 = await open(server, userA.token);
    await pause(25);
    const seenByB = recordStates(socketB);

    tab1.disconnect();
    await pause(75);

    expect(seenByB.filter((s) => participant(s, userA.userId)?.connected === false)).toEqual([]);
    expect(server.timers.size).toBe(0);
    expect(tab2.connected).toBe(true);
  });

  it("S-3: fermer tous les onglets n'arme qu'un minuteur, et revenir l'annule", async () => {
    const server = await start(400);
    const { userA, userB, socketA, socketB, code } = await roomWithTwo(server);
    const tab = await open(server, userA.token);
    const offline = waitForState(socketB, (s) => participant(s, userA.userId)?.connected === false);

    socketA.disconnect();
    tab.disconnect();

    await offline;
    expect(server.timers.size).toBe(1);

    const back = waitForState(socketB, (s) => participant(s, userA.userId)?.connected === true);
    await open(server, userA.token);
    await back;
    expect(server.timers.size).toBe(0);

    // Le délai s'écoule : A n'a pas été retiré.
    await pause(500);
    const check = await open(server, userB.token);
    const snapshot = waitForState(check, (s) => s.code === code);
    expectOk(await join(check, { code, role: "runner" }));
    expect(participant(await snapshot, userA.userId)?.connected).toBe(true);
  });

  it("S-3 (D4): des cycles déconnexion/retour du même utilisateur laissent au plus un minuteur", async () => {
    const server = await start(2000);
    const { userB, socketA, socketB } = await roomWithTwo(server);
    let current = socketB;

    for (let i = 0; i < 3; i += 1) {
      const gone = waitForState(socketA, (s) => participant(s, userB.userId)?.connected === false);
      current.disconnect();
      await gone;
      expect(server.timers.size).toBe(1);

      current = server.client(userB.token);
      await waitForConnection(current);
      expect(server.timers.size).toBe(0);
    }
  });

  it("S-4 (D3): leave depuis un onglet, l'autre onglet reçoit l'état sans A puis plus rien", async () => {
    const server = await start();
    const { userA, userB, socketA, socketB, code } = await roomWithTwo(server);
    const otherTab = await open(server, userA.token);
    const withoutA = (s: RoomState) => !participant(s, userA.userId);
    const stateOnLeavingTab = waitForState(socketA, withoutA);
    const stateOnOtherTab = waitForState(otherTab, withoutA);

    expect(await leave(socketA)).toEqual({ ok: true });

    expect((await stateOnLeavingTab).participants.map((p) => p.userId)).toEqual([userB.userId]);
    expect((await stateOnOtherTab).hostId).toBe(userB.userId);

    // Les diffusions suivantes ne lui parviennent plus.
    const afterLeaveA = recordStates(socketA);
    const afterLeaveTab = recordStates(otherTab);
    const configChanged = waitForState(socketB, (s) => s.config.length === "long");
    expect(await updateConfig(socketB, { length: "long" })).toEqual({ ok: true });
    await configChanged;
    await pause(50);
    expect(afterLeaveA).toEqual([]);
    expect(afterLeaveTab).toEqual([]);

    // Et il n'est plus dans aucune salle, depuis aucun onglet (D1).
    expect(await updateConfig(otherTab, { length: "short" })).toEqual({ ok: false, error: "NOT_IN_ROOM" });
    expect(await leave(otherTab)).toEqual({ ok: false, error: "NOT_IN_ROOM" });
    expectOk(await join(otherTab, { code, role: "spectator" }));
  });

  it("S-4 (SALLE-15): après leave, A peut créer une autre salle", async () => {
    const server = await start();
    const { code, socketA } = await roomWithTwo(server);
    expect(await leave(socketA)).toEqual({ ok: true });

    expect(expectOk(await create(socketA))).not.toBe(code);
  });

  it("S-4 (D3): le dernier humain qui part supprime la salle, ses onglets reçoivent l'état vide et sont nettoyés", async () => {
    const server = await start();
    const userA = server.sessions.signIn("member");
    const socketA = await open(server, userA.token);
    const otherTab = await open(server, userA.token);
    const code = expectOk(await create(socketA));
    await pause(25);
    const emptied = waitForState(otherTab, (s) => s.participants.length === 0);

    expect(await leave(socketA)).toEqual({ ok: true });

    expect((await emptied).status).toBe("closed");
    const afterwards = recordStates(otherTab);
    expect(await join(otherTab, { code, role: "runner" })).toEqual({ ok: false, error: "ROOM_NOT_FOUND" });
    await pause(25);
    expect(afterwards).toEqual([]);
    expect(server.io.sockets.adapter.rooms.has(code)).toBe(false);
  });

  it("S-5 (D1): updateConfig fonctionne après reconnexion, sans nouveau join", async () => {
    const server = await start();
    const { userA, socketA, socketB } = await roomWithTwo(server);
    socketA.disconnect();

    const socketA2 = await open(server, userA.token);
    const updated = waitForState(socketB, (s) => s.config.textMode === "words");
    expect(await updateConfig(socketA2, { textMode: "words" })).toEqual({ ok: true });
    expect((await updated).config.textMode).toBe("words");
  });

  it("S-5 (D1): un onglet ouvert avant la création partage la salle et peut modifier la config", async () => {
    const server = await start();
    const userA = server.sessions.signIn("member");
    const creator = await open(server, userA.token);
    const sibling = await open(server, userA.token);
    const siblingState = waitForState(sibling, (s) => s.participants.length === 1);

    const code = expectOk(await create(creator));

    expect((await siblingState).code).toBe(code);
    const changed = waitForState(creator, (s) => s.config.language === "en");
    expect(await updateConfig(sibling, { language: "en" })).toEqual({ ok: true });
    await changed;
  });

  it("D4: les minuteurs en attente sont vidés à la fermeture du serveur", async () => {
    const server = await startTestServer({ graceMs: LONG_GRACE_MS });
    const { userB, socketA, socketB } = await roomWithTwo(server);
    const offline = waitForState(socketA, (s) => participant(s, userB.userId)?.connected === false);
    socketB.disconnect();
    await offline;
    expect(server.timers.size).toBe(1);

    await server.close();

    expect(server.timers.size).toBe(0);
  });

  it("D4: deux serveurs ne partagent pas leurs minuteurs", async () => {
    const one = await start();
    const two = await start();
    const { userB, socketA, socketB } = await roomWithTwo(one);
    const offline = waitForState(socketA, (s) => participant(s, userB.userId)?.connected === false);
    socketB.disconnect();
    await offline;

    expect(one.timers.size).toBe(1);
    expect(two.timers.size).toBe(0);
  });
});

describe("roomHandlers: abus (énumération, connexions, taille, session)", () => {
  it("limite les échecs de room:join par utilisateur, puis répond INVALID_CODE sans consulter le registre", async () => {
    const server = await start();
    const { code } = await roomWithTwo(server);
    const attacker = await open(server, server.sessions.signIn("guest").token);

    for (let i = 0; i < 10; i += 1) {
      expect(await join(attacker, { code: "ZZZZZZ", role: "runner" })).toEqual({
        ok: false,
        error: "ROOM_NOT_FOUND",
      });
    }
    // Même un code valide et existant est refusé : le registre n'est plus consulté.
    expect(await join(attacker, { code, role: "runner" })).toEqual({ ok: false, error: "INVALID_CODE" });
  });

  it("compte aussi les codes mal formés, mais pas les charges utiles invalides", async () => {
    const server = await start();
    const { code } = await roomWithTwo(server);
    const sloppy = await open(server, server.sessions.signIn("guest").token);

    for (let i = 0; i < 20; i += 1) {
      expect(await join(sloppy, { nope: true })).toEqual({ ok: false, error: "INVALID_PAYLOAD" });
    }
    expectOk(await join(sloppy, { code, role: "spectator" }));

    const other = await open(server, server.sessions.signIn("guest").token);
    for (let i = 0; i < 10; i += 1) {
      expect(await join(other, { code: "abc", role: "runner" })).toEqual({ ok: false, error: "INVALID_CODE" });
    }
    expect(await join(other, { code, role: "spectator" })).toEqual({ ok: false, error: "INVALID_CODE" });
  });

  it("le plafond d'échecs est propre à chaque utilisateur", async () => {
    const server = await start();
    const { code } = await roomWithTwo(server);
    const attacker = await open(server, server.sessions.signIn("guest").token);
    for (let i = 0; i < 10; i += 1) await join(attacker, { code: "ZZZZZZ", role: "runner" });

    const innocent = await open(server, server.sessions.signIn("guest").token);
    expectOk(await join(innocent, { code, role: "spectator" }));
  });

  it("refuse la 6e connexion simultanée d'un utilisateur avec TOO_MANY_CONNECTIONS", async () => {
    const server = await start();
    const { token } = server.sessions.signIn("member");
    const opened: TestClient[] = [];
    for (let i = 0; i < 5; i += 1) opened.push(await open(server, token));

    const sixth = server.client(token);
    expect(await waitForConnection(sixth)).toEqual({ connected: false, error: "TOO_MANY_CONNECTIONS" });

    // Un autre utilisateur n'est pas concerné, et fermer un onglet libère une place.
    await open(server, server.sessions.signIn("member").token);
    opened[0].disconnect();
    await pause(50);
    await open(server, token);
  });

  it("coupe un client qui envoie un message de plus de 8 Ko", async () => {
    const server = await start();
    const socket = await open(server, server.sessions.signIn("member").token);
    const closed = new Promise<string>((resolve) => socket.once("disconnect", resolve));

    socket.emit("room:create", { textMode: "x".repeat(20_000) }, () => undefined);

    expect(await closed).toBeTruthy();
  });

  it("coupe un socket quand sa session expire, et nettoie le suivi", async () => {
    const server = await start();
    const { token } = server.sessions.signIn("member", "Zoé", { ttlMs: 150 });
    const socket = await open(server, token);
    expect(server.sessionExpiry.size).toBe(1);
    const closed = new Promise<string>((resolve) => socket.once("disconnect", resolve));

    expect(await closed).toBe("io server disconnect");

    await pause(25);
    expect(server.sessionExpiry.size).toBe(0);
    expect(await waitForConnection(server.client(token))).toEqual({ connected: false, error: "UNAUTHENTICATED" });
  });

  it("l'expiration d'un invité suit l'échéance de son compte", async () => {
    const server = await start();
    const { token } = server.sessions.signIn("guest", "Zoé", { ttlMs: 60_000, accountTtlMs: 150 });
    const socket = await open(server, token);
    const closed = new Promise<string>((resolve) => socket.once("disconnect", resolve));
    expect(await closed).toBe("io server disconnect");
  });

  it("le suivi d'échéance est annulé à la déconnexion et à la fermeture du serveur", async () => {
    const server = await startTestServer();
    const { token } = server.sessions.signIn("member");
    const one = await open(server, token);
    await open(server, token);
    expect(server.sessionExpiry.size).toBe(2);

    one.disconnect();
    await pause(50);
    expect(server.sessionExpiry.size).toBe(1);

    await server.close();
    expect(server.sessionExpiry.size).toBe(0);
  });
});
