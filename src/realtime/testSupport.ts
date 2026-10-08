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
export function createFakeSessions() {
  const rows = new Map<string, SessionWithUser>();
  let counter = 0;
  const repository: SessionRepository = {
    async insert() {},
    async findWithUser(id) {
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
    signIn(kind: "member" | "guest", displayName?: string) {
      counter += 1;
      const name = displayName ?? `${kind}-${counter}`;
      const token = generateToken();
      const id = `00000000-0000-4000-8000-${String(counter).padStart(12, "0")}`;
      const inOneHour = new Date(Date.now() + 3_600_000);
      rows.set(hashToken(token), {
        session: { expiresAt: inOneHour },
        user: {
          id,
          kind,
          displayName: name,
          username: kind === "member" ? name : null,
          locale: "fr",
          expiresAt: kind === "guest" ? inOneHour : null,
        },
      });
      return { token, userId: id };
    },
  };
}

/** Serveur sur un port libre ; `client(token)` ouvre une connexion avec le cookie de session. */
export async function startTestServer(options: { graceMs?: number } = {}) {
  const sessions = createFakeSessions();
  const { io, httpServer, timers } = createRealtimeServer({
    sessions: sessions.repository,
    allowedOrigins: [TEST_ORIGIN],
    graceMs: options.graceMs,
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
