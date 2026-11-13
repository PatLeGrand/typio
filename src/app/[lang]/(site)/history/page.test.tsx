import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/auth/types";
import { getDictionary } from "@/i18n/dictionaries";

const mocks = vi.hoisted(() => ({
  user: vi.fn<() => Promise<CurrentUser | null>>(),
  db: vi.fn(),
  list: vi.fn(),
  detail: vi.fn(),
}));
vi.mock("@/auth/currentUser", () => ({ getCurrentUser: mocks.user }));
vi.mock("@/db/shared", () => ({ getDb: mocks.db }));
vi.mock("@/race/drizzleRaceHistoryRepository", () => ({
  createDrizzleRaceHistoryRepository: () => ({ listUserRaces: mocks.list, getRaceForUser: mocks.detail }),
}));
vi.mock("next/navigation", () => ({
  redirect: (path: string): never => { throw new Error(`REDIRECT ${path}`); },
  notFound: (): never => { throw new Error("NOT_FOUND"); },
}));

import HistoryPage from "./page";
import RaceHistoryPage from "./[raceId]/page";

const member: CurrentUser = {
  id: "11111111-1111-1111-1111-111111111111", kind: "member",
  displayName: "Alice", username: "alice", locale: "fr", avatarVersion: null,
};
const raceId = "22222222-2222-2222-2222-222222222222";
const props = { params: Promise.resolve({ lang: "en", raceId }), searchParams: Promise.resolve({}) };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user.mockResolvedValue(member);
  mocks.list.mockResolvedValue({ items: [], hasNext: false });
  mocks.detail.mockResolvedValue(null);
});

describe.each([HistoryPage, RaceHistoryPage])("history access (%s)", (page) => {
  it("redirects visitors to login before accessing the database", async () => {
    mocks.user.mockResolvedValue(null);
    await expect(page(props)).rejects.toThrow("REDIRECT /en/login");
    expect(mocks.db).not.toHaveBeenCalled();
  });

  it("redirects guests to registration before accessing the database", async () => {
    mocks.user.mockResolvedValue({ ...member, kind: "guest", username: null });
    await expect(page(props)).rejects.toThrow("REDIRECT /en/register");
    expect(mocks.db).not.toHaveBeenCalled();
  });
});

it("validates the page and queries only the current member's results", async () => {
  render(await HistoryPage({ ...props, searchParams: Promise.resolve({ page: ["2", "3"] }) }));
  expect(mocks.list).toHaveBeenCalledWith(member.id, { page: 1, pageSize: 20 });
  const { history } = getDictionary("en");
  expect(screen.getByText(history.emptyFirst)).toBeInTheDocument();
  expect(screen.queryByRole("navigation", { name: history.pagination })).toBeNull();
  expect(screen.getByRole("link", { name: history.play })).toHaveAttribute("href", "/en/play");
});

it("offers a return to page 1 when a page is beyond the end", async () => {
  render(await HistoryPage({ ...props, searchParams: Promise.resolve({ page: "42" }) }));
  expect(mocks.list).toHaveBeenCalledWith(member.id, { page: 42, pageSize: 20 });
  expect(screen.getByRole("link", { name: getDictionary("en").history.firstPage })).toHaveAttribute("href", "/en/history");
});

it.each(["invalid", raceId])("renders the missing race content in server HTML (%s)", async (id) => {
  const html = renderToStaticMarkup(await RaceHistoryPage({ params: Promise.resolve({ lang: "en", raceId: id }) }));
  const document = new DOMParser().parseFromString(html, "text/html");
  const { notFound, site } = getDictionary("en");
  expect(html).toContain(notFound.title);
  expect(document.body.textContent).toContain(notFound.text);
  expect(html).toContain('href="/en"');
  expect(html).toContain('<meta name="robots" content="noindex"');
  expect(document.title).toBe(`${notFound.title} | ${site.name}`);
  // L'en-tête et le pied de page sont déjà fournis par (site)/layout.tsx.
  expect(html).not.toContain("<header");
  expect(html).not.toContain("<footer");
  if (id === "invalid") {
    expect(mocks.db).not.toHaveBeenCalled();
    expect(mocks.detail).not.toHaveBeenCalled();
  } else {
    expect(mocks.detail).toHaveBeenCalledWith(member.id, raceId);
  }
});
