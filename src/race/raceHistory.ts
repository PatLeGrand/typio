export const HISTORY_PAGE_SIZE = 20;
export const MAX_HISTORY_PAGE = 10_000;

export function parseHistoryPage(value: unknown): number {
  if (typeof value !== "string" || value.length === 0 || /\D/.test(value) || Number(value) < 1) return 1;
  return Math.min(Number(value), MAX_HISTORY_PAGE);
}

export function isRaceId(value: unknown): value is string {
  return typeof value === "string" && value.length === 36 && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function historyOffset(page: number, pageSize: number): number {
  return (page - 1) * pageSize;
}

export function historyPage<T>(rows: T[], pageSize: number) {
  return { items: rows.slice(0, pageSize), hasNext: rows.length > pageSize };
}
