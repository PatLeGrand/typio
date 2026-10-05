import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

/** Valeurs hexadécimales `--nom: #rrggbb;` d'un bloc CSS (`:root` ou `.dark`). */
function readTokens(selector: string): Record<string, string> {
  const block = new RegExp(`${selector.replace(".", "\\.")}\\s*\\{([^}]*)\\}`).exec(css);
  if (!block) throw new Error(`Bloc ${selector} introuvable dans globals.css`);
  const tokens: Record<string, string> = {};
  for (const [, name, value] of block[1].matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    tokens[name] = value;
  }
  return tokens;
}

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => channel(Number.parseInt(hex.slice(i, i + 2), 16)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Rapport de contraste WCAG 2.x entre deux couleurs hexadécimales. */
function contrastRatio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

const MIN_RATIO = 4.5;

// [texte, fond] : toutes les paires réellement utilisées par les composants.
const pairs: ReadonlyArray<readonly [string, string]> = [
  ["foreground", "background"],
  ["foreground", "surface"],
  ["muted", "background"],
  ["muted", "surface"],
  ["muted-strong", "accent-panel"],
  ["accent-text", "background"],
  ["accent-text", "surface"],
  ["accent-foreground", "accent"],
  ["key-ink", "key-yellow"],
  ["key-ink", "key-mint"],
  ["key-ink", "key-coral"],
  ["danger", "background"],
  ["danger", "surface"],
  ["accent-text", "accent-soft"],
  // Encarts d'information (texte foreground sur fond accent-soft).
  ["foreground", "accent-soft"],
  // Titre du panneau violet (PromisePanel), dont la deuxième ligne est en couleur d'accent.
  ["foreground", "accent-panel"],
  ["accent-text", "accent-panel"],
  // Panneau d'inscription (ProgressIsland) : textes posés directement sur l'île et la colline.
  ["foreground", "island-sand"],
  ["foreground", "island-mint"],
];

describe("contraste WCAG des tokens", () => {
  it("calcule correctement le rapport (noir sur blanc = 21)", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
  });

  describe.each([":root", ".dark"])("%s", (selector) => {
    const tokens = readTokens(selector);

    it.each(pairs)("%s sur %s >= 4,5", (foreground, background) => {
      expect(tokens[foreground], `--${foreground} manquant`).toBeDefined();
      expect(tokens[background], `--${background} manquant`).toBeDefined();
      expect(contrastRatio(tokens[foreground], tokens[background])).toBeGreaterThanOrEqual(MIN_RATIO);
    });
  });

  it("les deux thèmes définissent les mêmes tokens de couleur", () => {
    expect(Object.keys(readTokens(".dark")).sort()).toEqual(Object.keys(readTokens(":root")).sort());
  });
});
