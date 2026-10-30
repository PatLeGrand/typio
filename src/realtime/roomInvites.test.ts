// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { hashToken } from "@/auth/token";
import { MAX_INVITES_PER_ROOM, type Ack, type InviteInfo, type RoomState } from "./protocol";
import { createRoomStore } from "./roomStore";
import { startTestServer, waitForConnection, type TestClient } from "./testSupport";

const TOKEN_A = "A".repeat(42) + "0";
const IP = "203.0.113.7";
const OTHER_IP = "203.0.113.8";

const user = (id: string) => ({ id, displayName: `name-${id}`, kind: "member" as const });

/** Salle de `host`, privée par défaut ; les jetons tirés sont `A…A0`, `A…A1`, etc. */
function setup(visibility: "private" | "code" | "public" = "private", now?: () => number) {
  let drawn = 0;
  let codes = 0;
  const store = createRoomStore({
    now,
    generateCode: () => ["ABCDEF", "BCDEFG"][codes++] ?? "CDEFGH",
    generateInviteToken: () => String(drawn++).padStart(43, "A"),
  });
  const created = store.create(user("host"), { visibility }, "runner", 1);
  if (!created.ok) throw new Error("create failed");
  const invite = () => {
    const res = store.createInvite("host", "ABCDEF");
    if (!res.ok) throw new Error(res.error);
    return res.token;
  };
  return { store, invite };
}

describe("liens d'invitation (SALLE-04)", () => {
  it("ne garde que le hachage : un jeton inconnu est refusé, le jeton n'est dans aucune liste", () => {
    const { store, invite } = setup();
    const token = invite();
    expect(token).toBe(TOKEN_A);
    expect(JSON.stringify(store.invites("host", "ABCDEF"))).not.toContain(token);
    expect(JSON.stringify(store.invites("host", "ABCDEF"))).not.toContain(hashToken(token));
    expect(store.joinInvite(user("a"), "Z".repeat(43), "runner", IP, 2)).toEqual({ ok: false, error: "INVITE_INVALID" });
  });

  it("lie le lien à la première personne et à son IP, puis le réaccepte pour elle seule", () => {
    const { store, invite } = setup();
    const token = invite();
    expect(store.joinInvite(user("a"), token, "runner", IP, 2).ok).toBe(true);
    expect(store.invites("host", "ABCDEF")?.[0]).toMatchObject({ status: "used", usedBy: "name-a" });

    store.leave("a", "ABCDEF");
    expect(store.joinInvite(user("a"), token, "runner", IP, 3).ok).toBe(true);
    expect(store.joinInvite(user("a"), token, "runner", IP, 3).ok).toBe(true); // second onglet : pas de doublon
    expect(store.get("ABCDEF")?.participants.filter((p) => p.userId === "a")).toHaveLength(1);

    store.leave("a", "ABCDEF");
    expect(store.joinInvite(user("a"), token, "runner", OTHER_IP, 4)).toEqual({ ok: false, error: "INVITE_INVALID" });
    expect(store.joinInvite(user("b"), token, "runner", IP, 4)).toEqual({ ok: false, error: "INVITE_INVALID" });
  });

  it("laisse le lien neuf si l'entrée échoue (salle pleine)", () => {
    const { store, invite } = setup();
    store.updateConfig("host", "ABCDEF", { capacity: 2 });
    store.join(user("a"), "ABCDEF", "runner", 2); // refusé : privée
    const token = invite();
    expect(store.joinInvite(user("a"), token, "runner", IP, 2).ok).toBe(true);
    const second = invite();
    expect(store.joinInvite(user("b"), second, "runner", IP, 2)).toEqual({ ok: false, error: "ROOM_FULL" });
    expect(store.invites("host", "ABCDEF")?.[1].status).toBe("unused");
  });

  it("fait entrer dans une salle privée, que le code seul refuse, sans contourner SALLE-06 ni SALLE-09", () => {
    const { store, invite } = setup();
    expect(store.join(user("a"), "ABCDEF", "runner", 2)).toEqual({ ok: false, error: "INVITE_REQUIRED" });
    expect(store.joinInvite(user("a"), invite(), "runner", IP, 2).ok).toBe(true);

    store.create(user("other"), {}, "runner", 1);
    const second = invite();
    expect(store.joinInvite(user("other"), second, "runner", IP, 2)).toEqual({ ok: false, error: "ALREADY_IN_ROOM" });

    store.start("host", "ABCDEF");
    expect(store.joinInvite(user("c"), invite(), "runner", IP, 2)).toEqual({ ok: false, error: "RACE_IN_PROGRESS" });
  });

  it("plafonne les liens par salle", () => {
    const { store, invite } = setup();
    for (let i = 0; i < MAX_INVITES_PER_ROOM; i++) invite();
    expect(store.createInvite("host", "ABCDEF")).toEqual({ ok: false, error: "INVITE_LIMIT" });
  });

  it("réserve création et liste à l'hôte", () => {
    const { store, invite } = setup("code");
    store.join(user("a"), "ABCDEF", "runner", 2);
    expect(store.createInvite("a", "ABCDEF")).toEqual({ ok: false, error: "NOT_HOST" });
    expect(store.createInvite("stranger", "ABCDEF")).toEqual({ ok: false, error: "NOT_IN_ROOM" });
    invite();
    expect(store.invites("a", "ABCDEF")).toBeNull();
    expect(store.invites("host", "ABCDEF")).toHaveLength(1);
  });

  it("n'expose jamais les liens dans l'état de la salle", () => {
    const { store, invite } = setup();
    invite();
    const state = store.get("ABCDEF");
    expect(Object.keys(state ?? {}).sort()).toEqual(["code", "config", "hostId", "participants", "status"]);
  });

  it("invalide tous les liens à la fermeture de la salle", () => {
    const { store, invite } = setup();
    const token = invite();
    store.setStatus("ABCDEF", "results");
    expect(store.finish("host", "ABCDEF", true).ok).toBe(true);
    expect(store.joinInvite(user("a"), token, "runner", IP, 2)).toEqual({ ok: false, error: "INVITE_INVALID" });
  });

  it("invalide les liens quand le dernier humain part", () => {
    const { store, invite } = setup();
    const token = invite();
    store.leave("host", "ABCDEF");
    expect(store.joinInvite(user("a"), token, "runner", IP, 2)).toEqual({ ok: false, error: "INVITE_INVALID" });
  });
});

describe("expulsion (SALLE-07)", () => {
  function roomWith(...ids: string[]) {
    const ctx = setup("public");
    for (const id of ids) ctx.store.join(user(id), "ABCDEF", "runner", 2);
    return ctx;
  }

  it("est réservée à l'hôte, et il ne peut pas s'expulser", () => {
    const { store } = roomWith("a", "b");
    expect(store.kick("a", "ABCDEF", "b")).toEqual({ ok: false, error: "NOT_HOST" });
    expect(store.kick("host", "ABCDEF", "host")).toEqual({ ok: false, error: "INVALID_PAYLOAD" });
    expect(store.kick("host", "ABCDEF", "ghost")).toEqual({ ok: false, error: "NOT_IN_ROOM" });
    expect(store.get("ABCDEF")?.participants).toHaveLength(3);
  });

  it("retire la personne, révoque son lien et la bannit (KICKED par code, lien et partie rapide)", () => {
    const { store, invite } = setup("private");
    const token = invite();
    store.joinInvite(user("a"), token, "runner", IP, 2);
    store.updateConfig("host", "ABCDEF", { visibility: "public" });
    expect(store.kick("host", "ABCDEF", "a").ok).toBe(true);

    expect(store.get("ABCDEF")?.participants.map((p) => p.userId)).toEqual(["host"]);
    expect(store.roomOf("a")).toBeNull();
    expect(store.invites("host", "ABCDEF")?.[0].status).toBe("revoked");
    expect(store.join(user("a"), "ABCDEF", "runner", 3)).toEqual({ ok: false, error: "KICKED" });
    expect(store.joinInvite(user("a"), token, "runner", IP, 3)).toEqual({ ok: false, error: "KICKED" });
    expect(store.joinInvite(user("a"), invite(), "runner", IP, 3)).toEqual({ ok: false, error: "KICKED" });
    expect(store.quickJoinCode("a")).toBeNull();
    expect(store.quickJoinCode("b")).toBe("ABCDEF");
    // Le bannissement ne dépend pas de l'IP : un autre utilisateur depuis la même IP entre.
    expect(store.join(user("c"), "ABCDEF", "runner", 3).ok).toBe(true);
  });

  it("retire la personne de la course en cours comme un abandon, résultats cohérents", () => {
    let time = 1000;
    const { store } = setup("public", () => time);
    store.join(user("a"), "ABCDEF", "runner", 2);
    store.join(user("b"), "ABCDEF", "spectator", 2);
    expect(store.start("host", "ABCDEF").ok).toBe(true);
    time += 60_000; // le décompte est passé : la course est en cours

    expect(store.kick("host", "ABCDEF", "a").ok).toBe(true);
    expect(store.get("ABCDEF")?.participants.map((p) => p.userId)).toEqual(["host", "b"]);
    expect(store.abandon("host", "ABCDEF").ok).toBe(true);
    const results = store.results("ABCDEF");
    expect(results?.find((row) => row.id === "a")?.status).toBe("abandoned");
    expect(results?.find((row) => row.id === "host")?.status).toBe("abandoned");
  });
});

// ── Événements Socket.IO ────────────────────────────────────────────────────

type TestServer = Awaited<ReturnType<typeof startTestServer>>;
const servers: TestServer[] = [];
afterEach(async () => {
  for (const server of servers.splice(0)) await server.close();
});

const emitAck = <T>(emit: (ack: (res: T) => void) => void) => new Promise<T>((resolve) => emit(resolve));
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function open(server: TestServer, token: string, ip?: string): Promise<TestClient> {
  const socket = server.client(token, undefined, ip);
  const result = await waitForConnection(socket);
  if (!result.connected) throw new Error(result.error);
  return socket;
}

async function scenario() {
  const server = await startTestServer({ graceMs: 5000 });
  servers.push(server);
  const host = server.sessions.signIn("member", "Hote");
  const guest = server.sessions.signIn("member", "Invite");
  const hostSocket = await open(server, host.token, IP);
  const states: RoomState[] = [];
  const hostInvites: InviteInfo[][] = [];
  hostSocket.on("room:state", (state) => states.push(state));
  hostSocket.on("room:invites", (invites) => hostInvites.push(invites));
  const created = await emitAck<Ack<{ code: string }>>((ack) =>
    hostSocket.emit("room:create", { config: { visibility: "private" }, role: "runner" }, ack));
  if (!created.ok) throw new Error(created.error);
  const createInvite = (socket: TestClient) =>
    emitAck<Ack<{ id: string; token: string }>>((ack) => socket.emit("room:createInvite", {}, ack));
  return { server, host, guest, hostSocket, states, hostInvites, code: created.data.code, createInvite };
}

describe("événements d'invitation et d'expulsion", () => {
  it("n'envoie la liste qu'à l'hôte, jamais dans room:state, et lie le lien à l'IP du handshake", async () => {
    const { server, guest, hostSocket, states, hostInvites, createInvite } = await scenario();
    const made = await createInvite(hostSocket);
    if (!made.ok) throw new Error(made.error);
    await pause(50);
    expect(hostInvites.at(-1)).toMatchObject([{ id: made.data.id, status: "unused", usedBy: null }]);

    const wrongIp = await open(server, guest.token, OTHER_IP);
    expect(await emitAck<Ack<{ code: string }>>((ack) => wrongIp.emit("room:joinInvite", { token: made.data.token, role: "runner" }, ack)))
      .toMatchObject({ ok: true });
    const received: InviteInfo[][] = [];
    wrongIp.on("room:invites", (invites) => received.push(invites));
    expect(await createInvite(wrongIp)).toEqual({ ok: false, error: "NOT_HOST" });
    await pause(50);

    expect(received).toEqual([]);
    expect(hostInvites.at(-1)).toMatchObject([{ status: "used", usedBy: "Invite" }]);
    expect(JSON.stringify(states)).not.toContain(made.data.token);
    expect(JSON.stringify(states)).not.toContain("invites");

    // Même utilisateur, autre IP, après être parti : refusé.
    await emitAck<Ack>((ack) => wrongIp.emit("room:leave", ack));
    const elsewhere = await open(server, guest.token, IP);
    expect(await emitAck<Ack<{ code: string }>>((ack) => elsewhere.emit("room:joinInvite", { token: made.data.token, role: "runner" }, ack)))
      .toEqual({ ok: false, error: "INVITE_INVALID" });
    expect(await emitAck<Ack<{ code: string }>>((ack) => elsewhere.emit("room:joinInvite", { token: "court", role: "runner" }, ack)))
      .toEqual({ ok: false, error: "INVALID_PAYLOAD" });
  });

  it("envoie la liste au nouvel hôte après le départ de l'hôte (SALLE-08)", async () => {
    const { server, guest, hostSocket, createInvite } = await scenario();
    const made = await createInvite(hostSocket);
    if (!made.ok) throw new Error(made.error);
    const guestSocket = await open(server, guest.token, IP);
    await emitAck<Ack<{ code: string }>>((ack) => guestSocket.emit("room:joinInvite", { token: made.data.token, role: "runner" }, ack));
    const received: InviteInfo[][] = [];
    guestSocket.on("room:invites", (invites) => received.push(invites));

    await emitAck<Ack>((ack) => hostSocket.emit("room:leave", ack));
    await pause(100);
    expect(received.at(-1)).toMatchObject([{ id: made.data.id, status: "used" }]);
  });

  it("expulse : événement à l'expulsé, sortie de la room, refus ensuite, liste de l'hôte à jour", async () => {
    const { server, guest, host, hostSocket, hostInvites, code, createInvite } = await scenario();
    const made = await createInvite(hostSocket);
    if (!made.ok) throw new Error(made.error);
    const guestSocket = await open(server, guest.token, IP);
    await emitAck<Ack<{ code: string }>>((ack) => guestSocket.emit("room:joinInvite", { token: made.data.token, role: "runner" }, ack));
    let kicked = 0;
    guestSocket.on("room:kicked", () => kicked++);

    expect(await emitAck<Ack>((ack) => guestSocket.emit("room:kick", { userId: host.userId }, ack))).toEqual({ ok: false, error: "NOT_HOST" });
    expect(await emitAck<Ack>((ack) => hostSocket.emit("room:kick", { userId: host.userId }, ack))).toEqual({ ok: false, error: "INVALID_PAYLOAD" });
    expect(await emitAck<Ack>((ack) => hostSocket.emit("room:kick", { userId: "x" }, ack))).toEqual({ ok: false, error: "INVALID_PAYLOAD" });
    expect(await emitAck<Ack>((ack) => hostSocket.emit("room:kick", { userId: guest.userId }, ack))).toEqual({ ok: true });
    await pause(100);

    expect(kicked).toBe(1);
    expect(hostInvites.at(-1)).toMatchObject([{ status: "revoked" }]);
    expect((await server.io.in(code).fetchSockets()).map((s) => s.data.user.id)).toEqual([host.userId]);
    expect(await emitAck<Ack<{ code: string }>>((ack) => guestSocket.emit("room:join", { code, role: "runner" }, ack)))
      .toEqual({ ok: false, error: "KICKED" });
    expect(await emitAck<Ack<{ code: string }>>((ack) => guestSocket.emit("room:joinInvite", { token: made.data.token, role: "runner" }, ack)))
      .toEqual({ ok: false, error: "KICKED" });
  });
});
