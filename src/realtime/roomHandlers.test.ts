import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { startTestServer, waitForConnection, type TestClient } from "./testSupport";
import type { RoomState, RoomErrorCode, Ack } from "./protocol";

describe("roomHandlers (Lot 2)", () => {
  let serverInfo: Awaited<ReturnType<typeof startTestServer>>;

  beforeEach(async () => {
    serverInfo = await startTestServer();
  });

  afterEach(async () => {
    await serverInfo.close();
  });

  const joinAndWait = async (socket: TestClient) => {
    const res = await waitForConnection(socket);
    if (!res.connected) throw new Error("Socket failed to connect");
  };

  const waitForState = (socket: TestClient, condition: (s: RoomState) => boolean): Promise<RoomState> => {
    return new Promise((resolve) => {
      const listener = (state: RoomState) => {
        if (condition(state)) {
          socket.off("room:state", listener);
          resolve(state);
        }
      };
      socket.on("room:state", listener);
    });
  };

  it("AC-1: Membre A crée → accusé et room:state", async () => {
    const userA = serverInfo.sessions.signIn("member");
    const socketA = serverInfo.client(userA.token);
    await joinAndWait(socketA);

    const statePromise = waitForState(socketA, s => s.participants.length === 1);

    const ack = await new Promise<Ack<{ code: string }>>((resolve) => {
      socketA.emit("room:create", { textMode: "words" }, resolve);
    });

    expect(ack.ok).toBe(true);
    if (!ack.ok) return;

    expect(ack.data.code).toBeTruthy();

    const state = await statePromise;
    expect(state.code).toBe(ack.data.code);
    expect(state.participants).toHaveLength(1);
    expect(state.config.textMode).toBe("words");
  });

  it("AC-2: Invité B rejoint → A et B reçoivent room:state", async () => {
    const userA = serverInfo.sessions.signIn("member");
    const socketA = serverInfo.client(userA.token);
    await joinAndWait(socketA);

    const statePromiseA1 = waitForState(socketA, s => s.participants.length === 1);

    const ackA = await new Promise<Ack<{ code: string }>>((resolve) => {
      socketA.emit("room:create", {}, resolve);
    });
    if (!ackA.ok) throw new Error();
    const code = ackA.data.code;

    // Attendre que A reçoive son propre join
    await statePromiseA1;

    const userB = serverInfo.sessions.signIn("guest");
    const socketB = serverInfo.client(userB.token);
    await joinAndWait(socketB);

    const statePromiseA = waitForState(socketA, s => s.participants.length === 2);
    const statePromiseB = waitForState(socketB, s => s.participants.length === 2);

    const ackB = await new Promise<Ack<{ code: string }>>((resolve) => {
      socketB.emit("room:join", { code, role: "runner" }, resolve);
    });
    expect(ackB.ok).toBe(true);

    const stateA = await statePromiseA;
    const stateB = await statePromiseB;

    expect(stateA.participants).toHaveLength(2);
    expect(stateB.participants).toHaveLength(2);
    expect(stateA).toEqual(stateB);
  });

  it("AC-3: A change la langue → B reçoit le room:state mis à jour", async () => {
    const userA = serverInfo.sessions.signIn("member");
    const socketA = serverInfo.client(userA.token);
    await joinAndWait(socketA);

    const ackA = await new Promise<Ack<{ code: string }>>((resolve) => socketA.emit("room:create", {}, resolve));
    if (!ackA.ok) throw new Error();
    const code = ackA.data.code;

    const userB = serverInfo.sessions.signIn("guest");
    const socketB = serverInfo.client(userB.token);
    await joinAndWait(socketB);
    await new Promise<Ack<{ code: string }>>((resolve) => socketB.emit("room:join", { code, role: "runner" }, resolve));

    const statePromiseB = waitForState(socketB, s => s.config.language === "en");

    const updateAck = await new Promise<Ack>((resolve) => socketA.emit("room:updateConfig", { language: "en" }, resolve));
    expect(updateAck.ok).toBe(true);

    const stateB = await statePromiseB;
    expect(stateB.config.language).toBe("en");
  });

  it("AC-4: B tente updateConfig → accusé NOT_HOST, aucune diffusion", async () => {
    const userA = serverInfo.sessions.signIn("member");
    const socketA = serverInfo.client(userA.token);
    await joinAndWait(socketA);

    const ackA = await new Promise<Ack<{ code: string }>>((resolve) => socketA.emit("room:create", {}, resolve));
    if (!ackA.ok) throw new Error();
    const code = ackA.data.code;

    const userB = serverInfo.sessions.signIn("guest");
    const socketB = serverInfo.client(userB.token);
    await joinAndWait(socketB);
    const statePromiseAAfterJoin = waitForState(socketA, s => s.participants.length === 2);
    await new Promise<Ack<{ code: string }>>((resolve) => socketB.emit("room:join", { code, role: "runner" }, resolve));
    await statePromiseAAfterJoin;

    // Flush any pending events for A before checking
    await new Promise(r => setTimeout(r, 10));

    let emitted = false;
    const listener = () => { emitted = true; };
    socketA.once("room:state", listener);

    const updateAck = await new Promise<Ack>((resolve) => socketB.emit("room:updateConfig", { language: "en" }, resolve));
    
    expect(updateAck).toEqual({ ok: false, error: "NOT_HOST" });
    
    // Attendre un peu pour s'assurer qu'aucun événement n'a été diffusé
    await new Promise(r => setTimeout(r, 50));
    socketA.off("room:state", listener);
    expect(emitted).toBe(false);
  });

  it("AC-5: B tente room:create → GUEST_CANNOT_CREATE", async () => {
    const userB = serverInfo.sessions.signIn("guest");
    const socketB = serverInfo.client(userB.token);
    await joinAndWait(socketB);

    const ack = await new Promise<Ack<{ code: string }>>((resolve) => socketB.emit("room:create", {}, resolve));
    expect(ack).toEqual({ ok: false, error: "GUEST_CANNOT_CREATE" });
  });

  it("AC-6: Charge utile invalide", async () => {
    const userA = serverInfo.sessions.signIn("member");
    const socketA = serverInfo.client(userA.token);
    await joinAndWait(socketA);

    const ack1 = await new Promise<Ack<{ code: string }>>((resolve) => socketA.emit("room:create", { hostId: "x" }, resolve));
    expect(ack1).toEqual({ ok: false, error: "INVALID_PAYLOAD" });

    const ack2 = await new Promise<Ack<{ code: string }>>((resolve) => socketA.emit("room:join", { code: "abc", role: "runner" }, resolve));
    expect(ack2).toEqual({ ok: false, error: "INVALID_CODE" });
  });

  it("AC-7: A quitte → B reçoit un état où il est hôte", async () => {
    const userA = serverInfo.sessions.signIn("member");
    const socketA = serverInfo.client(userA.token);
    await joinAndWait(socketA);

    const ackA = await new Promise<Ack<{ code: string }>>((resolve) => socketA.emit("room:create", {}, resolve));
    if (!ackA.ok) throw new Error();
    const code = ackA.data.code;

    const userB = serverInfo.sessions.signIn("guest");
    const socketB = serverInfo.client(userB.token);
    await joinAndWait(socketB);
    await new Promise<Ack<{ code: string }>>((resolve) => socketB.emit("room:join", { code, role: "runner" }, resolve));

    const statePromiseB = waitForState(socketB, s => s.participants.length === 1);

    const leaveAck = await new Promise<Ack>((resolve) => socketA.emit("room:leave", resolve));
    expect(leaveAck.ok).toBe(true);

    const stateB = await statePromiseB;
    expect(stateB.participants).toHaveLength(1);
    expect(stateB.hostId).toBe(userB.userId); // B est le nouvel hôte
  });

  it("AC-8: B se déconnecte → A voit connected: false", async () => {
    const userA = serverInfo.sessions.signIn("member");
    const socketA = serverInfo.client(userA.token);
    await joinAndWait(socketA);

    const ackA = await new Promise<Ack<{ code: string }>>((resolve) => socketA.emit("room:create", {}, resolve));
    if (!ackA.ok) throw new Error();
    const code = ackA.data.code;

    const userB = serverInfo.sessions.signIn("guest");
    const socketB = serverInfo.client(userB.token);
    await joinAndWait(socketB);
    await new Promise<Ack<{ code: string }>>((resolve) => socketB.emit("room:join", { code, role: "runner" }, resolve));

    const statePromiseA = waitForState(socketA, s => {
      const p = s.participants.find(p => p.userId === userB.userId);
      return p ? !p.connected : false;
    });

    // B se déconnecte
    socketB.disconnect();

    const stateA = await statePromiseA;
    const pB = stateA.participants.find(p => p.userId === userB.userId);
    expect(pB?.connected).toBe(false);
  });
});
