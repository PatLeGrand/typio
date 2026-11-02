// @vitest-environment node
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { describe, expect, it, vi } from "vitest";
import { createDrizzleTextCorpusRepository } from "./drizzleTextCorpusRepository";
import { classifySentence, EMPTY_CORPUS } from "./textGenerator";

describe("text corpus repository", () => {
  it("partage un seul chargement concurrent et classe les phrases au chargement", async () => {
    const content = "Le chat dort sur le lit.";
    const from = vi.fn(async () => [{ language: "fr", content }]);
    const db = { select: () => ({ from }) } as unknown as PostgresJsDatabase;
    const repository = createDrizzleTextCorpusRepository(() => db);
    const [first, second] = await Promise.all([repository.load(), repository.load()]);
    expect(first).toBe(second);
    expect(first.fr[classifySentence(content)]).toEqual([content]);
    expect(await repository.load()).toBe(first);
    expect(from).toHaveBeenCalledTimes(1);
  });
  it("rend un corpus vide quand la base est indisponible et journalise sans paramètres", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const repository = createDrizzleTextCorpusRepository(() => { throw new Error("database unavailable"); });
      expect(await repository.load()).toBe(EMPTY_CORPUS);
      expect(log).toHaveBeenCalledTimes(1);
    } finally {
      log.mockRestore();
    }
  });
});
