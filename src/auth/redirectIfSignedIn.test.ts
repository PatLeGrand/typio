import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "./types";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn<() => Promise<CurrentUser | null>>(),
  redirect: vi.fn(),
}));

vi.mock("./currentUser", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import { redirectIfSignedIn } from "./redirectIfSignedIn";

const user: CurrentUser = {
  id: "11111111-1111-1111-1111-111111111111",
  kind: "member",
  displayName: "Alice",
  username: "alice",
  locale: "fr",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("redirectIfSignedIn", () => {
  it.each(["fr", "en"] as const)("renvoie un membre connecté vers l'accueil de la langue (%s)", async (locale) => {
    mocks.getCurrentUser.mockResolvedValue(user);

    await redirectIfSignedIn(locale);

    expect(mocks.redirect).toHaveBeenCalledWith(`/${locale}`);
  });

  it("renvoie aussi un invité connecté", async () => {
    mocks.getCurrentUser.mockResolvedValue({ ...user, kind: "guest", username: null });

    await redirectIfSignedIn("en");

    expect(mocks.redirect).toHaveBeenCalledWith("/en");
  });

  it("laisse passer un visiteur", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);

    await redirectIfSignedIn("fr");

    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
