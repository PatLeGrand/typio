import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateToken } from "@/auth/token";
import { getDictionary } from "@/i18n/dictionaries";

// B-3 : base injoignable. Le VRAI accesseur d'affichage est utilisé ; seule la base échoue.
const mocks = vi.hoisted(() => ({ token: "" }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (name === "typio_session" ? { name, value: mocks.token } : undefined),
  }),
}));
vi.mock("@/auth/deps", () => ({
  getAuthDeps: () => {
    throw Object.assign(new Error("connect ECONNREFUSED postgres://typio:secret@db/typio"), { code: "ECONNREFUSED" });
  },
}));
vi.mock("@/auth/actions", () => ({ logout: vi.fn(), login: vi.fn(), register: vi.fn(), continueAsGuest: vi.fn() }));
vi.mock("@/auth/schedulePurge", () => ({ schedulePurge: vi.fn() }));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  usePathname: () => "/fr",
}));

import LoginPage from "./(auth)/login/page";
import SiteLayout from "./(site)/layout";
import Home from "./(site)/page";

function props(lang: string) {
  return { params: Promise.resolve({ lang }), searchParams: Promise.resolve({}) };
}

beforeEach(() => {
  mocks.token = generateToken();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("base de données injoignable, cookie de session présent", () => {
  it("le layout du site se rend avec un en-tête « visiteur » au lieu d'une erreur 500", async () => {
    const { header } = getDictionary("fr");
    render(await SiteLayout({ children: <p>contenu</p>, params: Promise.resolve({ lang: "fr" }) }));

    expect(screen.getByRole("link", { name: header.signIn })).toHaveAttribute("href", "/fr/login");
    expect(screen.getByText("contenu")).toBeInTheDocument();
  });

  it("l'accueil se rend avec les liens de visiteur", async () => {
    const { home } = getDictionary("fr");
    render(await Home(props("fr")));

    expect(screen.getAllByRole("link", { name: home.signIn }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: home.signUp }).length).toBeGreaterThan(0);
  });

  it("la page de connexion se rend (pas de redirection, pas d'exception)", async () => {
    const { login } = getDictionary("fr");
    render(await LoginPage(props("fr")));

    expect(screen.getByRole("heading", { level: 1, name: login.title })).toBeInTheDocument();
  });

  it("journalise la panne sans secret", async () => {
    render(await Home(props("fr")));

    const logged = JSON.stringify(vi.mocked(console.error).mock.calls);
    expect(logged).toContain("ECONNREFUSED");
    expect(logged).not.toContain("secret");
  });
});
