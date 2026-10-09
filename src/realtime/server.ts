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
import { createRateLimiter } from "@/auth/rateLimit";
import { createGraceTimers, type GraceTimers } from "./graceTimers";
import { registerRoomHandlers } from "./roomHandlers";
import { createRoomStore } from "./roomStore";
import { createSessionExpiryWatcher, type SessionExpiryWatcher } from "./sessionExpiry";
import { createUserSockets, MAX_SOCKETS_PER_USER, type UserSockets } from "./userSockets";

/**
 * Taille maximale d'un message entrant, en octets. Les charges utiles légitimes (code, rôle,
 * patch de configuration) tiennent en quelques dizaines d'octets ; la valeur par défaut de
 * Socket.IO (1 Mo) laisserait un client faire allouer des mégaoctets par message.
 */
export const MAX_MESSAGE_BYTES = 8_192;

/**
 * Échecs de `room:join` tolérés par utilisateur et par minute (codes inconnus ou mal formés) :
 * borne l'énumération des codes de salle (H-5).
 */
export const JOIN_FAILURE_LIMIT = { limit: 10, windowMs: 60_000 } as const;

export type RealtimeServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

export interface RealtimeServerOptions {
  sessions: SessionRepository;
  /** Origines autorisées à ouvrir une connexion, par exemple `https://typio.aether-manager.ca`. */
  allowedOrigins: readonly string[];
  now?: () => Date;
  /** Délai de grâce avant le retrait d'un participant déconnecté ; `RECONNECT_GRACE_MS` par défaut. */
  graceMs?: number;
  /** Intervalle de relecture de la session de chaque socket ; `SESSION_REVALIDATE_MS` par défaut. */
  revalidateMs?: number;
}

export interface RealtimeServerHandle {
  io: RealtimeServer;
  httpServer: HttpServer;
  /** Minuteurs de grâce de ce serveur, vidés à sa fermeture. */
  timers: GraceTimers;
  /** Suivi des échéances de session des sockets ouverts, vidé à la fermeture. */
  sessionExpiry: SessionExpiryWatcher;
  /** Index des sockets ouverts par utilisateur. */
  userSockets: UserSockets;
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
    maxHttpBufferSize: MAX_MESSAGE_BYTES,
    // En production, Caddy sert le site et le service sur la même origine : CORS ne sert
    // qu'au développement, où Next (3000) et ce service (3001) ont deux ports.
    cors: { origin: [...options.allowedOrigins], credentials: true },
    allowRequest: (req, callback) => {
      callback(null, isAllowedOrigin(req.headers.origin, options.allowedOrigins));
    },
  });

  const userSockets = createUserSockets();
  const sessionExpiry = createSessionExpiryWatcher(now, { revalidateMs: options.revalidateMs });
  /** Échéance de session de chaque socket en cours de connexion, hors de `SocketData`. */
  const handshakeExpiry = new WeakMap<object, Date>();

  io.use(async (socket, next) => {
    try {
      const identity = await authenticateHandshake(options.sessions, socket.request.headers.cookie, now());
      if (!identity) return next(new Error("UNAUTHENTICATED"));
      if (userSockets.count(identity.user.id) >= MAX_SOCKETS_PER_USER) {
        return next(new Error("TOO_MANY_CONNECTIONS"));
      }
      socket.data.user = identity.user;
      socket.data.roomCode = null;
      handshakeExpiry.set(socket, identity.expiresAt);
      next();
    } catch {
      next(new Error("INTERNAL"));
    }
  });

  const store = createRoomStore();
  const timers = createGraceTimers();
  const joinFailures = createRateLimiter({ ...JOIN_FAILURE_LIMIT, now: () => now().getTime() });

  // `io.close()` ferme le serveur HTTP : plus aucun minuteur ne doit survivre.
  httpServer.on("close", () => {
    timers.close();
    sessionExpiry.close();
  });

  io.on("connection", (socket) => {
    // Des poignées de main simultanées passent toutes le contrôle du middleware avant que
    // l'une d'elles soit comptée : le plafond est donc revérifié ici, de façon synchrone.
    if (userSockets.count(socket.data.user.id) >= MAX_SOCKETS_PER_USER) {
      socket.disconnect(true);
      return;
    }
    userSockets.add(socket);
    socket.on("disconnect", () => userSockets.remove(socket));

    registerRoomHandlers(io, socket, {
      now,
      store,
      timers,
      graceMs: options.graceMs,
      sockets: userSockets,
      joinFailures,
    });

    // Après les gestionnaires : une échéance déjà passée coupe le socket tout de suite, et
    // le `disconnect` des gestionnaires doit alors le voir (marquer déconnecté, armer la grâce).
    const expiresAt = handshakeExpiry.get(socket);
    if (expiresAt) {
      // Même lecture que la poignée de main, sur le cookie qu'elle portait : la session doit
      // exister toujours et appartenir au même utilisateur. Une erreur de base lève, et le
      // suivi garde alors le socket.
      const cookie = socket.request.headers.cookie;
      const userId = socket.data.user.id;
      sessionExpiry.watch(socket, expiresAt, async () => {
        const identity = await authenticateHandshake(options.sessions, cookie, now());
        return identity?.user.id === userId;
      });
    }
  });

  return { io, httpServer, timers, sessionExpiry, userSockets };
}
