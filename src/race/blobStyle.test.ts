import { describe, expect, it } from "vitest";
import {
  BLOB_ACCESSORIES,
  BLOB_COLORS,
  BLOB_COLOR_HEX,
  BLOB_EXPRESSIONS,
  BLOB_GLASSES,
  BLOB_HATS,
  DEFAULT_BLOB_STYLE,
  blobStyleEquals,
  blobStyleKey,
  parseBlobStyle,
  randomBlobStyle,
} from "./blobStyle";
import { BLOB_SVG_HEIGHT, BLOB_SVG_WIDTH, blobSvgDataUrl, renderBlobSvg } from "./blobSvg";

describe("blobStyle model", () => {
  it("expose le style par défaut bleu ciel, sourire classique et sans accessoires", () => {
    expect(DEFAULT_BLOB_STYLE).toEqual({
      color: "sky",
      expression: "smile",
      glasses: "none",
      hat: "none",
      accessory: "none",
    });
    expect(BLOB_COLOR_HEX.sky).toBe("#54B7E5");
  });

  it("valide toutes les options et ignore les propriétés superflues", () => {
    for (const color of BLOB_COLORS) {
      expect(parseBlobStyle({ ...DEFAULT_BLOB_STYLE, color, extra: "ignored" })).toEqual({
        ...DEFAULT_BLOB_STYLE,
        color,
      });
    }
    for (const expression of BLOB_EXPRESSIONS) {
      expect(parseBlobStyle({ ...DEFAULT_BLOB_STYLE, expression })).toEqual({
        ...DEFAULT_BLOB_STYLE,
        expression,
      });
    }
    for (const glasses of BLOB_GLASSES) {
      expect(parseBlobStyle({ ...DEFAULT_BLOB_STYLE, glasses })).toEqual({
        ...DEFAULT_BLOB_STYLE,
        glasses,
      });
    }
    for (const hat of BLOB_HATS) {
      expect(parseBlobStyle({ ...DEFAULT_BLOB_STYLE, hat })).toEqual({
        ...DEFAULT_BLOB_STYLE,
        hat,
      });
    }
    for (const accessory of BLOB_ACCESSORIES) {
      expect(parseBlobStyle({ ...DEFAULT_BLOB_STYLE, accessory })).toEqual({
        ...DEFAULT_BLOB_STYLE,
        accessory,
      });
    }
  });

  it("complète les anciens styles sans expression ni accessoire avec les valeurs par défaut", () => {
    expect(parseBlobStyle({ color: "mint", glasses: "round", hat: "crown" })).toEqual({
      color: "mint",
      expression: "smile",
      glasses: "round",
      hat: "crown",
      accessory: "none",
    });
  });

  it("rejette les valeurs invalides, nulles ou incomplètes", () => {
    expect(parseBlobStyle(null)).toBeNull();
    expect(parseBlobStyle(undefined)).toBeNull();
    expect(parseBlobStyle("sky")).toBeNull();
    expect(parseBlobStyle([])).toBeNull();
    expect(parseBlobStyle({ color: "sky", glasses: "none" })).toBeNull();
    expect(parseBlobStyle({ color: "neon", glasses: "none", hat: "none" })).toBeNull();
    expect(parseBlobStyle({ color: "sky", glasses: "unknown", hat: "none" })).toBeNull();
    expect(parseBlobStyle({ color: "sky", glasses: "none", hat: "helmet" })).toBeNull();
    expect(parseBlobStyle({ ...DEFAULT_BLOB_STYLE, expression: "angry" })).toBeNull();
    expect(parseBlobStyle({ ...DEFAULT_BLOB_STYLE, accessory: "sword" })).toBeNull();
    expect(parseBlobStyle({ color: 123, glasses: "none", hat: "none" })).toBeNull();
  });

  it("compare et génère une clé stable", () => {
    const a = {
      color: "coral" as const,
      expression: "wink" as const,
      glasses: "shades" as const,
      hat: "cap" as const,
      accessory: "scarf" as const,
    };
    const b = { ...a };
    expect(blobStyleEquals(a, b)).toBe(true);
    expect(blobStyleEquals(a, DEFAULT_BLOB_STYLE)).toBe(false);
    expect(blobStyleKey(a)).toBe("coral:wink:shades:cap:scarf");
  });

  it("génère un style aléatoire toujours valide", () => {
    const generated = randomBlobStyle(() => 0.9999);
    expect(parseBlobStyle(generated)).toEqual(generated);
    expect(generated).toEqual({
      color: BLOB_COLORS[BLOB_COLORS.length - 1],
      expression: BLOB_EXPRESSIONS[BLOB_EXPRESSIONS.length - 1],
      glasses: BLOB_GLASSES[BLOB_GLASSES.length - 1],
      hat: BLOB_HATS[BLOB_HATS.length - 1],
      accessory: BLOB_ACCESSORIES[BLOB_ACCESSORIES.length - 1],
    });
  });
});

describe("renderBlobSvg", () => {
  it("respecte la silhouette et les couleurs d'origine pour DEFAULT_BLOB_STYLE", () => {
    const svg = renderBlobSvg(DEFAULT_BLOB_STYLE);
    expect(svg).toContain(`viewBox="0 0 ${BLOB_SVG_WIDTH} ${BLOB_SVG_HEIGHT}"`);
    expect(svg).toContain('fill="#54B7E5"');
    expect(svg).toContain('stroke="#293C49"');
    expect(svg).toContain('id="Expression-smile"');
    expect(svg).not.toContain('id="Glasses-');
    expect(svg).not.toContain('id="Hat-');
    expect(svg).not.toContain('id="Accessory-');
  });

  it("combine couleur, expression, lunettes, couvre-chef et accessoire dans un SVG valide encodé en data URL", () => {
    const style = {
      color: "tangerine" as const,
      expression: "determined" as const,
      glasses: "visor" as const,
      hat: "headphones" as const,
      accessory: "cape" as const,
    };
    const svg = renderBlobSvg(style);
    expect(svg).toContain(`fill="${BLOB_COLOR_HEX.tangerine}"`);
    expect(svg).toContain('id="Expression-determined"');
    expect(svg).toContain('id="Glasses-visor"');
    expect(svg).toContain('id="Hat-headphones"');
    expect(svg).toContain('id="Accessory-cape-back"');
    expect(svg).toContain('id="Accessory-cape"');

    const url = blobSvgDataUrl(style);
    expect(url.startsWith("data:image/svg+xml;charset=utf-8,")).toBe(true);
    expect(decodeURIComponent(url.slice("data:image/svg+xml;charset=utf-8,".length))).toBe(svg);
  });

  it("produit un SVG non vide pour chaque option de chaque catégorie", () => {
    for (const expression of BLOB_EXPRESSIONS) {
      expect(renderBlobSvg({ ...DEFAULT_BLOB_STYLE, expression })).toContain(`id="Expression-${expression}"`);
    }
    for (const glasses of BLOB_GLASSES) {
      const svg = renderBlobSvg({ ...DEFAULT_BLOB_STYLE, glasses });
      if (glasses === "none") expect(svg).not.toContain('id="Glasses-');
      else expect(svg).toContain(`id="Glasses-${glasses}"`);
    }
    for (const hat of BLOB_HATS) {
      const svg = renderBlobSvg({ ...DEFAULT_BLOB_STYLE, hat });
      if (hat === "none") expect(svg).not.toContain('id="Hat-');
      else expect(svg).toContain(`id="Hat-${hat}"`);
    }
    for (const accessory of BLOB_ACCESSORIES) {
      const svg = renderBlobSvg({ ...DEFAULT_BLOB_STYLE, accessory });
      if (accessory === "none") expect(svg).not.toContain('id="Accessory-');
      else expect(svg).toContain(`id="Accessory-${accessory}`);
    }
  });
});
