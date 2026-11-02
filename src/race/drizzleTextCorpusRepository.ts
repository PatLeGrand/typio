import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { textPassages } from "@/db/schema";
import { getDb } from "@/db/shared";
import { describeError } from "@/auth/errors";
import { classifyCorpus, EMPTY_CORPUS, type SentenceCorpus } from "./textGenerator";

/** Un chargement partagé entre les appels concurrents, dans chaque processus serveur. */
export function createDrizzleTextCorpusRepository(database: () => PostgresJsDatabase) {
  let corpus: Promise<SentenceCorpus> | undefined;
  return {
    load(): Promise<SentenceCorpus> {
      corpus ??= (async () => {
        try {
          const rows = await database().select().from(textPassages);
          return classifyCorpus({
            fr: rows.filter((row) => row.language === "fr").map((row) => row.content),
            en: rows.filter((row) => row.language === "en").map((row) => row.content),
          });
        } catch (error) {
          console.error("[corpus] load failed", describeError(error));
          return EMPTY_CORPUS;
        }
      })();
      return corpus;
    },
  };
}

export const textCorpusRepository = createDrizzleTextCorpusRepository(getDb);
