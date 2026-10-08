/**
 * Service temps réel (ADR-001) : un serveur HTTP qui porte Socket.IO sur `/socket.io/*`
 * et une route de santé `/healthz` pour Docker. Séparé de `main.ts` pour que les tests
 * l'instancient avec un faux dépôt de sessions, sans base ni variables d'environnement.
 */

import { createServer, type Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import type { SessionRepository } from "@/auth/session";
import { authenticateHandshake, isAllowedOrigin } from "./auth";
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from "./protocol";
import { createGraceTimers, type GraceTimers } from "./graceTimers";
import { registerRoomHandlers } from "./roomHandlers";
import { createRoomStore } from "./roomStore";

export type RealtimeServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

export interface RealtimeServerOptions {
  sessions: SessionRepository;
  /** Origines autorisées à ouvrir une connexion, par exemple `https://typio.aether-manager.ca`. */
  allowedOrigins: readonly string[];
  now?: () => Date;
  /** Délai de grâce avant le retrait d'un participant déconnecté ; `RECONNECT_GRACE_MS` par défaut. */
  graceMs?: number;
}

export interface RealtimeServerHandle {
  io: RealtimeServer;
  httpServer: HttpServer;
  /** Minuteurs de grâce de ce serveur, vidés à sa fermeture. */
  timers: GraceTimers;
}

export function createRealtimeServer(options: RealtimeServerOptions): RealtimeServerHandle {
  const now = options.now ?? (() => new Date());

  const httpServer = createServer((req, res) => {
    if (req.method === "GET" && req.url === "/healthz") {
      res.writeHead(200, { "content-type": "text/plain" }).end("ok");
      return;
    }
    // Socket.IO intercepte lui-même `/socket.io/*` avant ce gestionnaire.
    res.writeHead(404).end();
  });

  const io: RealtimeServer = new Server(httpServer, {
    // En production, Caddy sert le site et le service sur la même origine : CORS ne sert
    // qu'au développement, où Next (3000) et ce service (3001) ont deux ports.
    cors: { origin: [...options.allowedOrigins], credentials: true },
    allowRequest: (req, callback) => {
      callback(null, isAllowedOrigin(req.headers.origin, options.allowedOrigins));
    },
  });

  io.use(async (socket, next) => {
    try {
      const user = await authenticateHandshake(options.sessions, socket.request.headers.cookie, now());
      if (!user) return next(new Error("UNAUTHENTICATED"));
      socket.data.user = user;
      socket.data.roomCode = null;
      next();
    } catch {
      next(new Error("INTERNAL"));
    }
  });

  const store = createRoomStore();
  const timers = createGraceTimers();

  // `io.close()` ferme le serveur HTTP : plus aucun minuteur de grâce ne doit survivre.
  httpServer.on("close", () => timers.close());

  io.on("connection", (socket) =>
    registerRoomHandlers(io, socket, { now, store, timers, graceMs: options.graceMs }),
  );

  return { io, httpServer, timers };
}
