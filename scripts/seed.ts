import { createDatabaseClient } from "../src/db/client";
import { seedDatabase } from "./seed/data";

const { db, close } = createDatabaseClient();
try {
  await seedDatabase(db);
  console.info("Database seed completed.");
} finally {
  await close();
}
