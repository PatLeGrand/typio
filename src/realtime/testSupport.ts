/**
 * Outils de test du service temps réel : un dépôt de sessions en mémoire et des clients
 * Socket.IO authentifiés contre un serveur lancé sur un port libre.
 */

import type { AddressInfo } from "node:net";
import { io as connect, type Socket } from "socket.io-client";
import { generateToken, hashToken } from "@/auth/token";
import type { SessionRepository, SessionWithUser } from "@/auth/session";
import type { ClientToServerEvents, ServerToClientEvents } from "./protocol";
import { createRealtimeServer } from "./server";

export const TEST_ORIGIN = "http://localhost:3000";

export type TestClient = Socket<ServerToClientEvents, ClientToServerEvents>;

/** Sessions en mémoire ; `signIn` crée un utilisateur et renvoie le jeton de son cookie. */
export function createFakeSessions(gate: { current: Promise<void> | null } = { current: null }) {
  const rows = new Map<string, SessionWithUser>();
  let counter = 0;
  let failing = false;
  const repository: SessionRepository = {
    async insert() {},
    async findWithUser(id) {
      // Poignées de main suspendues : toutes reprennent d'un coup (voir `holdAuth`).
      if (gate.current) await gate.current;
      if (failing) throw new Error("database unavailable");
      return rows.get(id) ?? null;
    },
    async delete(id) {
      rows.delete(id);
    },
    async deleteExpired() {
      return 0;
    },
  };
  return {
    repository,
    /** Supprime la session, comme une déconnexion faite dans un autre onglet. */
    revoke(token: string) {
      rows.delete(hashToken(token));
    },
    /** Fait échouer toute lecture de session, comme une base indisponible. */
    setDatabaseDown(down: boolean) {
      failing = down;
    },
    /**
     * `ttlMs` : durée de la session (1 h par défaut) ; `accountTtlMs` : durée du compte
     * invité (égale à celle de la session par défaut).
     */
    signIn(kind: "member" | "guest", displayName?: string, options: { ttlMs?: number; accountTtlMs?: number } = {}) {
      counter += 1;
      const name = displayName ?? `${kind}-${counter}`;
      const token = generateToken();
      const id = `00000000-0000-4000-8000-${String(counter).padStart(12, "0")}`;
      const sessionExpiry = new Date(Date.now() + (options.ttlMs ?? 3_600_000));
      const accountExpiry = new Date(Date.now() + (options.accountTtlMs ?? options.ttlMs ?? 3_600_000));
      rows.set(hashToken(token), {
        session: { expiresAt: sessionExpiry },
        user: {
          id,
          kind,
          displayName: name,
          username: kind === "member" ? name : null,
          locale: "fr",
          expiresAt: kind === "guest" ? accountExpiry : null,
        },
      });
      return { token, userId: id };
    },
  };
}

/** Serveur sur un port libre ; `client(token)` ouvre une connexion avec le cookie de session. */
export async function startTestServer(options: { graceMs?: number; revalidateMs?: number } = {}) {
  const gate: { current: Promise<void> | null } = { current: null };
  let releaseGate = () => {};
  const sessions = createFakeSessions(gate);
  const { io, httpServer, timers, sessionExpiry, userSockets } = createRealtimeServer({
    sessions: sessions.repository,
    allowedOrigins: [TEST_ORIGIN],
    graceMs: options.graceMs,
    revalidateMs: options.revalidateMs,
  });
  await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
  const { port } = httpServer.address() as AddressInfo;
  const url = `http://127.0.0.1:${port}`;
  const clients: TestClient[] = [];

  return {
    url,
    sessions,
    io,
    timers,
    sessionExpiry,
    userSockets,
    /** Suspend l'authentification des poignées de main jusqu'à `releaseAuth` (pour les rendre simultanées). */
    holdAuth() {
      gate.current = new Promise<void>((resolve) => {
        releaseGate = resolve;
      });
    },
    releaseAuth() {
      releaseGate();
      gate.current = null;
    },
    client(token: string | null, origin = TEST_ORIGIN): TestClient {
      const socket: TestClient = connect(url, {
        transports: ["websocket"],
        forceNew: true,
        reconnection: false,
        extraHeaders: {
          origin,
          ...(token ? { cookie: `typio_session=${token}` } : {}),
        },
      });
      clients.push(socket);
      return socket;
    },
    async close() {
      for (const socket of clients) socket.disconnect();
      await new Promise<void>((resolve) => io.close(() => resolve()));
    },
  };
}

/** Attend la connexion ou son refus ; renvoie le message d'erreur du refus. */
export function waitForConnection(
  socket: TestClient,
): Promise<{ connected: true } | { connected: false; error: string }> {
  return new Promise((resolve) => {
    socket.once("connect", () => resolve({ connected: true }));
    socket.once("connect_error", (error) => resolve({ connected: false, error: error.message }));
  });
}
