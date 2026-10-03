import { describe, expect, it } from "vitest";
import { createDatabaseClient } from "@/db/client";

describe("createDatabaseClient", () => {
  it("requires a database URL", () => {
    expect(() => createDatabaseClient("")).toThrow(
      "DATABASE_URL is required to connect to PostgreSQL",
    );
  });
});
