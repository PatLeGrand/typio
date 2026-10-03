import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const MAX_DATABASE_CONNECTIONS = 5;

export function createDatabaseClient(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to connect to PostgreSQL");
  }

  const sql = postgres(databaseUrl, {
    max: MAX_DATABASE_CONNECTIONS,
    prepare: false,
  });

  return {
    db: drizzle(sql),
    close: () => sql.end(),
  };
}
