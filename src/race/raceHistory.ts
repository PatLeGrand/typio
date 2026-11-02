import { z } from "zod";

export const HISTORY_PAGE_SIZE = 20;
export const MAX_HISTORY_PAGE = 10_000;

/** Numéro de page de `?page=` : chiffres seuls, au moins 1, plafonné ; sinon la page 1. */
const historyPageSchema = z
  .string()
  .regex(/^\d+$/)
  .transform(Number)
  .refine((page) => page >= 1)
  .transform((page) => Math.min(page, MAX_HISTORY_PAGE))
  .catch(1);

export function parseHistoryPage(value: unknown): number {
  return historyPageSchema.parse(value);
}

/** Identifiant de course : UUID textuel (toute variante hexadécimale 8-4-4-4-12). */
const raceIdSchema = z.guid();

export function isRaceId(value: unknown): value is string {
  return raceIdSchema.safeParse(value).success;
}

export function historyOffset(page: number, pageSize: number): number {
  return (page - 1) * pageSize;
}

export function historyPage<T>(rows: T[], pageSize: number) {
  return { items: rows.slice(0, pageSize), hasNext: rows.length > pageSize };
}
