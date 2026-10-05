import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "./types";

const mocks = vi.hoisted(() => ({
  getCurrentUserForDisplay: vi.fn<() => Promise<CurrentUser | null>>(),
  redirect: vi.fn(),
}));

vi.mock("./currentUser", () => ({ getCurrentUserForDisplay: mocks.getCurrentUserForDisplay }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import { redirectIfSignedIn } from "./redirectIfSignedIn";

const member: CurrentUser = {
  id: "11111111-1111-1111-1111-111111111111",
  kind: "member",
  displayName: "Alice",
  username: "alice",
  locale: "fr",
};
const guest: CurrentUser = { ...member, kind: "guest", username: null };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("redirectIfSignedIn", () => {
  it.each(["fr", "en"] as const)("renvoie un membre connecté vers l'accueil de la langue (%s)", async (locale) => {
    mocks.getCurrentUserForDisplay.mockResolvedValue(member);

    await redirectIfSignedIn(locale);

    expect(mocks.redirect).toHaveBeenCalledWith(`/${locale}`);
  });

  it("renvoie un membre même quand les invités sont autorisés", async () => {
    mocks.getCurrentUserForDisplay.mockResolvedValue(member);

    await redirectIfSignedIn("en", { allowGuests: true });

    expect(mocks.redirect).toHaveBeenCalledWith("/en");
  });

  it("renvoie un invité par défaut (page « invité »)", async () => {
    mocks.getCurrentUserForDisplay.mockResolvedValue(guest);

    await redirectIfSignedIn("en");

    expect(mocks.redirect).toHaveBeenCalledWith("/en");
  });

  it("laisse un invité atteindre la page quand les invités sont autorisés (connexion, inscription)", async () => {
    mocks.getCurrentUserForDisplay.mockResolvedValue(guest);

    await redirectIfSignedIn("fr", { allowGuests: true });

    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("laisse passer un visiteur", async () => {
    mocks.getCurrentUserForDisplay.mockResolvedValue(null);

    await redirectIfSignedIn("fr");
    await redirectIfSignedIn("fr", { allowGuests: true });

    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
