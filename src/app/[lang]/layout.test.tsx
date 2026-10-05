import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { getDictionary } from "@/i18n/dictionaries";
import { themeInitScript } from "@/theme/themeScript";
import RootLayout, { dynamicParams, generateMetadata, generateStaticParams } from "./layout";

// next/font/google n'est compilé que par Next ; ici on simule sa sortie.
vi.mock("next/font/google", () => ({ Inter: () => ({ variable: "font-inter-mock" }) }));

function layoutProps(lang: string) {
  return { children: <p>contenu</p>, params: Promise.resolve({ lang }) };
}

describe("RootLayout", () => {
  it("pose la locale sur <html> et rend le contenu, sans en-tête (il vit dans (site)/layout)", async () => {
    const html = renderToStaticMarkup(await RootLayout(layoutProps("en")));

    expect(html).toContain('<html lang="en"');
    expect(html).not.toContain("<header");
    expect(html).toContain("<p>contenu</p>");
    // <html> ne porte aucun className : la classe `dark` y est gérée hors de React.
    expect(html).not.toMatch(/<html[^>]*class=/);
  });

  it("branche la variable de police Inter sur <body>", async () => {
    const html = renderToStaticMarkup(await RootLayout(layoutProps("fr")));
    expect(html).toMatch(/<body[^>]*class="[^"]*font-inter-mock/);
  });

  it("pose la locale française sur <html>", async () => {
    const html = renderToStaticMarkup(await RootLayout(layoutProps("fr")));
    expect(html).toContain('<html lang="fr"');
  });

  it("injecte le script de thème dans le <head>, avant le <body>", async () => {
    const html = renderToStaticMarkup(await RootLayout(layoutProps("en")));
    const head = html.slice(html.indexOf("<head>"), html.indexOf("</head>"));

    expect(head).toContain(themeInitScript);
    expect(html.indexOf(themeInitScript)).toBeLessThan(html.indexOf("<body"));
  });

  it("déclenche une 404 pour une locale inconnue", async () => {
    await expect(RootLayout(layoutProps("de"))).rejects.toMatchObject({ digest: expect.stringContaining("404") });
  });
});

describe("configuration de route", () => {
  it("prérend exactement fr et en", () => {
    expect(generateStaticParams()).toEqual([{ lang: "fr" }, { lang: "en" }]);
  });

  it("refuse les paramètres hors de generateStaticParams", () => {
    expect(dynamicParams).toBe(false);
  });
});

describe("generateMetadata", () => {
  it.each(["fr", "en"] as const)("renvoie titre et description traduits (%s)", async (lang) => {
    const { meta } = getDictionary(lang);
    const metadata = await generateMetadata({ params: Promise.resolve({ lang }) } as Parameters<typeof generateMetadata>[0]);
    expect(metadata).toEqual({ title: meta.title, description: meta.description });
  });

  it("déclenche une 404 pour une locale inconnue", async () => {
    await expect(
      generateMetadata({ params: Promise.resolve({ lang: "de" }) } as Parameters<typeof generateMetadata>[0]),
    ).rejects.toMatchObject({ digest: expect.stringContaining("404") });
  });
});
