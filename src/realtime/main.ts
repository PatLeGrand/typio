/**
 * Point d'entrée du service `realtime`, lancé hors de Next (ADR-001) :
 *   développement : bun run dev:realtime
 *   image Docker  : bun realtime.js (compilé par `bun run build:realtime`)
 */

import { createDrizzleSessionRepository } from "@/auth/drizzleSessionRepository";
import { createDatabaseClient } from "@/db/client";
import { createRealtimeServer } from "./server";

const port = Number(process.env.REALTIME_PORT ?? 3001);
const allowedOrigins = (process.env.APP_ORIGIN ?? "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const { db, close } = createDatabaseClient();
const { io, httpServer } = createRealtimeServer({
  sessions: createDrizzleSessionRepository(db),
  allowedOrigins,
});

// HOSTNAME=0.0.0.0 dans l'image, comme pour Next : c'est compose qui limite l'exposition.
httpServer.listen(port, process.env.HOSTNAME ?? "127.0.0.1", () => {
  console.log(`realtime listening on ${port}, origins: ${allowedOrigins.join(", ")}`);
});

// `docker compose up` remplace le conteneur par SIGTERM : on ferme proprement.
process.on("SIGTERM", () => {
  io.close(() => {
    void close().finally(() => process.exit(0));
  });
});
