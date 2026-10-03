import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createDatabaseClient } from "../src/db/client";

const { db, close } = createDatabaseClient();

try {
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.info("Database migrations completed.");
} finally {
  await close();
}
