import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/auth/types";
import { getDictionary } from "@/i18n/dictionaries";

const mocks = vi.hoisted(() => ({
  getCurrentUserForDisplay: vi.fn<() => Promise<CurrentUser | null>>(),
  redirect: vi.fn<(path: string) => never>(),
}));

vi.mock("@/auth/currentUser", () => ({ getCurrentUserForDisplay: mocks.getCurrentUserForDisplay }));
vi.mock("@/auth/actions", () => ({ login: vi.fn(), register: vi.fn(), continueAsGuest: vi.fn() }));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  usePathname: () => "/fr/login",
  redirect: mocks.redirect,
}));

import GuestPage, { generateMetadata as guestMetadata } from "./guest/page";
import LoginPage, { generateMetadata as loginMetadata } from "./login/page";
import RegisterPage, { generateMetadata as registerMetadata } from "./register/page";

const REDIRECTED = "NEXT_REDIRECT_TEST";

const member: CurrentUser = {
  id: "11111111-1111-1111-1111-111111111111",
  kind: "member",
  displayName: "Alice",
  username: "alice",
  locale: "fr",
};

function props(lang: string, searchParams: Record<string, string | string[] | undefined> = {}) {
  return { params: Promise.resolve({ lang }), searchParams: Promise.resolve(searchParams) };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Aucun fournisseur configuré par défaut, quelles que soient les variables du poste.
  for (const name of ["APP_ORIGIN", "GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET", "DISCORD_CLIENT_ID", "DISCORD_CLIENT_SECRET"]) {
    vi.stubEnv(name, "");
  }
  mocks.getCurrentUserForDisplay.mockResolvedValue(null);
  mocks.redirect.mockImplementation((path) => {
    throw new Error(`${REDIRECTED}:${path}`);
  });
});

const pages = [
  { name: "login", Page: LoginPage },
  { name: "register", Page: RegisterPage },
  { name: "guest", Page: GuestPage },
] as const;

describe.each(pages)("page $name : utilisateur connecté", ({ Page }) => {
  it.each(["fr", "en"] as const)("redirige un membre vers l'accueil de la langue (%s)", async (lang) => {
    mocks.getCurrentUserForDisplay.mockResolvedValue(member);

    await expect(Page(props(lang))).rejects.toThrow(`${REDIRECTED}:/${lang}`);
  });

  it("répond par une 404 pour une locale inconnue", async () => {
    await expect(Page(props("de"))).rejects.toMatchObject({ digest: expect.stringContaining("404") });
  });
});

describe("invité connecté", () => {
  const guestUser: CurrentUser = { ...member, kind: "guest", username: null };

  it.each([
    ["login", LoginPage],
    ["register", RegisterPage],
  ] as const)("peut atteindre la page %s pour se créer un compte", async (_name, Page) => {
    mocks.getCurrentUserForDisplay.mockResolvedValue(guestUser);

    render(await Page(props("fr")));

    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("est renvoyé à l'accueil depuis la page « invité »", async () => {
    mocks.getCurrentUserForDisplay.mockResolvedValue(guestUser);

    await expect(GuestPage(props("fr"))).rejects.toThrow(`${REDIRECTED}:/fr`);
  });
});

describe("page login", () => {
  it.each(["fr", "en"] as const)("suit l'ordre AUTH-1 et affiche les blocs de la maquette (%s)", async (lang) => {
    const { login, auth, oauth } = getDictionary(lang);
    render(await LoginPage(props(lang)));

    expect(screen.getByRole("heading", { level: 1, name: login.title })).toBeInTheDocument();
    expect(screen.getByText(auth.kicker)).toBeInTheDocument();
    expect(screen.getByText(login.divider)).toBeInTheDocument();
    expect(screen.getByText(login.securityNote)).toBeInTheDocument();
    expect(screen.getByText(login.sharedComputerNote)).toBeInTheDocument();

    // AUTH-1 : GitHub et Discord avant le formulaire d'identifiant.
    const github = screen.getByRole("button", { name: new RegExp(oauth.github) });
    const username = screen.getByRole("textbox", { name: login.usernameLabel });
    expect(github.compareDocumentPosition(username) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("« Rester connecté » est décochée par défaut et il n'y a pas de « mot de passe oublié »", async () => {
    const { login } = getDictionary("fr");
    render(await LoginPage(props("fr")));

    expect(screen.getByRole("checkbox", { name: login.remember })).not.toBeChecked();
    expect(screen.queryByText(/oublié/i)).toBeNull();
  });

  it.each(["fr", "en"] as const)("le bouton « invité » est un lien vers /guest, sous le bouton principal (%s)", async (lang) => {
    const { login } = getDictionary(lang);
    render(await LoginPage(props(lang)));

    const guest = screen.getByRole("link", { name: login.guestButton });
    expect(guest).toHaveAttribute("href", `/${lang}/guest`);
    expect(guest.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText(login.guestNote)).toBeInTheDocument();
    const submit = screen.getByRole("button", { name: login.submit });
    expect(submit.compareDocumentPosition(guest) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // La phrase « Pas de compte ? Joue en invité » est remplacée par ce bouton.
    expect(screen.getAllByRole("link", { name: /invité|guest/i })).toHaveLength(1);
  });

  it.each(["fr", "en"] as const)("propose l'inscription et la confidentialité (%s)", async (lang) => {
    const { login, footer } = getDictionary(lang);
    render(await LoginPage(props(lang)));

    expect(screen.getByRole("link", { name: login.signUpLink })).toHaveAttribute("href", `/${lang}/register`);
    expect(screen.getByRole("link", { name: footer.privacy })).toHaveAttribute("href", `/${lang}/privacy`);
  });

  it.each(["fr", "en"] as const)("métadonnées traduites (%s)", async (lang) => {
    const { meta } = getDictionary(lang).login;
    const metadata = await loginMetadata(props(lang) as Parameters<typeof loginMetadata>[0]);
    expect(metadata).toEqual({ title: meta.title, description: meta.description });
  });
});

describe("page login : connexion GitHub et Discord", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function configureProviders() {
    vi.stubEnv("APP_ORIGIN", "https://typio.example");
    for (const name of ["GITHUB", "DISCORD"]) {
      vi.stubEnv(`${name}_CLIENT_ID`, "id");
      vi.stubEnv(`${name}_CLIENT_SECRET`, "secret");
    }
  }

  it("sans configuration, les boutons sont désactivés avec « bientôt »", async () => {
    render(await LoginPage(props("fr")));

    expect(screen.getByRole("button", { name: /GitHub/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Discord/ })).toBeDisabled();
  });

  it.each(["fr", "en"] as const)("avec la configuration, les boutons sont des liens actifs avec la langue (%s)", async (lang) => {
    configureProviders();
    render(await LoginPage(props(lang)));

    expect(screen.getByRole("link", { name: "GitHub" })).toHaveAttribute("href", `/api/auth/github?locale=${lang}`);
    expect(screen.getByRole("link", { name: "Discord" })).toHaveAttribute("href", `/api/auth/discord?locale=${lang}`);
  });

  it.each(["fr", "en"] as const)("affiche la mention des 13 ans sous les boutons (%s)", async (lang) => {
    const { oauth } = getDictionary(lang);
    render(await LoginPage(props(lang)));

    expect(screen.getByText(oauth.ageNote)).toBeInTheDocument();
  });

  it.each(["cancelled", "failed", "unavailable", "already_linked"] as const)(
    "?oauth=%s affiche le message traduit dans une alerte, avant les boutons (fr et en)",
    async (notice) => {
      for (const lang of ["fr", "en"] as const) {
        const { login } = getDictionary(lang);
        const { unmount } = render(await LoginPage(props(lang, { oauth: notice })));

        const alert = screen.getByRole("alert");
        expect(alert).toHaveTextContent(login.oauthErrors[notice]);
        const group = screen.getByRole("group", { name: getDictionary(lang).oauth.groupLabel });
        expect(alert.compareDocumentPosition(group) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        unmount();
      }
    },
  );

  it("n'affiche aucune alerte sans paramètre, ni pour une valeur inconnue ou répétée", async () => {
    for (const searchParams of [{}, { oauth: "hacked" }, { oauth: ["failed", "cancelled"] }, { other: "failed" }]) {
      const { unmount } = render(await LoginPage(props("fr", searchParams)));
      expect(screen.queryByRole("alert")).toBeNull();
      unmount();
    }
  });
});

describe("page register : connexion GitHub et Discord", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each(["fr", "en"] as const)("affiche la mention des 13 ans et les liens actifs une fois configurée (%s)", async (lang) => {
    vi.stubEnv("APP_ORIGIN", "http://localhost:3000");
    vi.stubEnv("GITHUB_CLIENT_ID", "id");
    vi.stubEnv("GITHUB_CLIENT_SECRET", "secret");
    const { oauth } = getDictionary(lang);

    render(await RegisterPage(props(lang)));

    expect(screen.getByText(oauth.ageNote)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "GitHub" })).toHaveAttribute("href", `/api/auth/github?locale=${lang}`);
    expect(screen.getByRole("button", { name: /Discord/ })).toBeDisabled();
  });

  it("n'affiche aucune alerte OAuth : le message est réservé à la page de connexion", async () => {
    render(await RegisterPage(props("fr", { oauth: "failed" })));

    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("page register", () => {
  it.each(["fr", "en"] as const)("affiche le formulaire sans e-mail, l'île et les liens (%s)", async (lang) => {
    const { register, island } = getDictionary(lang);
    const { container } = render(await RegisterPage(props(lang)));

    expect(screen.getByRole("heading", { level: 1, name: register.title })).toBeInTheDocument();
    expect(screen.getByText(register.divider)).toBeInTheDocument();
    expect(container.querySelector('input[type="email"]')).toBeNull();
    expect(screen.getByText(island.progressTitle)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: register.signInLink })).toHaveAttribute("href", `/${lang}/login`);
  });

  it.each(["fr", "en"] as const)("métadonnées traduites (%s)", async (lang) => {
    const { meta } = getDictionary(lang).register;
    const metadata = await registerMetadata(props(lang) as Parameters<typeof registerMetadata>[0]);
    expect(metadata).toEqual({ title: meta.title, description: meta.description });
  });
});

describe("page guest", () => {
  it.each(["fr", "en"] as const)("affiche le pseudo, la durée de 24 h et la mention sur les courses (%s)", async (lang) => {
    const { guest } = getDictionary(lang);
    render(await GuestPage(props(lang)));

    expect(screen.getByRole("heading", { level: 1, name: guest.title })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: guest.pseudoLabel })).toBeInTheDocument();
    expect(screen.getByText(guest.limits)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: guest.signInLink })).toHaveAttribute("href", `/${lang}/login`);
  });

  it("la phrase d'information mentionne 24 h", async () => {
    expect(getDictionary("fr").guest.limits).toMatch(/24 h/);
    expect(getDictionary("en").guest.limits).toMatch(/24 hours/);
  });

  it.each(["fr", "en"] as const)("métadonnées traduites (%s)", async (lang) => {
    const { meta } = getDictionary(lang).guest;
    const metadata = await guestMetadata(props(lang) as Parameters<typeof guestMetadata>[0]);
    expect(metadata).toEqual({ title: meta.title, description: meta.description });
  });
});
