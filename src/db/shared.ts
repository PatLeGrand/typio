import { createDatabaseClient } from "./client";

const globalForDb = globalThis as typeof globalThis & { __typioDb?: ReturnType<typeof createDatabaseClient> };

export function getDb() {
  if (!globalForDb.__typioDb) {
    globalForDb.__typioDb = createDatabaseClient();
  }
  return globalForDb.__typioDb.db;
}
