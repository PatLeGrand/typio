import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { config, proxy } from "./proxy";

function request(path: string, headers: Record<string, string> = {}) {
  return new NextRequest(`http://localhost:3000${path}`, { headers });
}

function redirectTarget(response: Response | undefined): string | null {
  return response?.headers.get("location") ?? null;
}

describe("proxy", () => {
  it("redirige / selon Accept-Language (en-US vers /en)", () => {
    const response = proxy(request("/", { "accept-language": "en-US,en;q=0.9" }));
    expect(response.status).toBe(307);
    expect(redirectTarget(response)).toBe("http://localhost:3000/en");
  });

  it("redirige / vers /fr pour fr-CA ou sans en-tête", () => {
    expect(redirectTarget(proxy(request("/", { "accept-language": "fr-CA" })))).toBe("http://localhost:3000/fr");
    expect(redirectTarget(proxy(request("/")))).toBe("http://localhost:3000/fr");
  });

  it("le cookie NEXT_LOCALE l'emporte quel que soit l'en-tête", () => {
    const response = proxy(request("/", { cookie: "NEXT_LOCALE=en", "accept-language": "fr-FR,fr;q=0.9" }));
    expect(redirectTarget(response)).toBe("http://localhost:3000/en");
  });

  it("ignore un cookie invalide", () => {
    const response = proxy(request("/", { cookie: "NEXT_LOCALE=de", "accept-language": "en-US" }));
    expect(redirectTarget(response)).toBe("http://localhost:3000/en");
  });

  it("préfixe les chemins profonds et conserve la query string", () => {
    const response = proxy(request("/room/abc?x=1", { "accept-language": "en" }));
    expect(redirectTarget(response)).toBe("http://localhost:3000/en/room/abc?x=1");
  });

  it("laisse passer un chemin déjà préfixé", () => {
    const response = proxy(request("/en/room", { cookie: "NEXT_LOCALE=en" }));
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("mémorise la langue du chemin quand le cookie est absent", () => {
    const response = proxy(request("/en/room"));
    expect(response.headers.get("x-middleware-next")).toBe("1");
    const cookie = response.cookies.get("NEXT_LOCALE");
    expect(cookie).toMatchObject({ value: "en", path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  });

  it("met à jour le cookie quand il diffère de la langue du chemin", () => {
    const response = proxy(request("/fr", { cookie: "NEXT_LOCALE=en" }));
    expect(response.cookies.get("NEXT_LOCALE")?.value).toBe("fr");
  });

  it("n'écrit pas de cookie quand il correspond déjà", () => {
    const response = proxy(request("/fr/room", { cookie: "NEXT_LOCALE=fr" }));
    expect(response.cookies.get("NEXT_LOCALE")).toBeUndefined();
  });

  it("n'écrit pas de cookie sur /api ni /_next", () => {
    expect(proxy(request("/api/health")).cookies.get("NEXT_LOCALE")).toBeUndefined();
    expect(proxy(request("/_next/static/x.js")).cookies.get("NEXT_LOCALE")).toBeUndefined();
  });

  it("laisse passer /api et /_next", () => {
    expect(proxy(request("/api/health")).headers.get("location")).toBeNull();
    expect(proxy(request("/_next/static/x.js")).headers.get("location")).toBeNull();
  });
});

describe("config.matcher", () => {
  const [matcher] = config.matcher;
  // Le matcher de Next est de la forme « /(<regex>) » ; on teste la partie regex.
  const pattern = new RegExp(`^/${matcher.slice(1)}$`);

  it("couvre les pages", () => {
    for (const path of ["/", "/fr", "/room/abc", "/de", "/apiary"]) expect(pattern.test(path)).toBe(true);
  });

  it("exclut /api, /_next et les fichiers statiques", () => {
    for (const path of ["/api", "/api/health", "/_next/static/x.js", "/favicon.ico", "/robots.txt", "/img/logo.png"]) {
      expect(pattern.test(path)).toBe(false);
    }
  });
});
