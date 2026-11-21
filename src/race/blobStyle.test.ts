import { describe, expect, it } from "vitest";
import {
  BLOB_COLORS,
  BLOB_COLOR_HEX,
  BLOB_GLASSES,
  BLOB_HATS,
  DEFAULT_BLOB_STYLE,
  blobStyleEquals,
  blobStyleKey,
  parseBlobStyle,
} from "./blobStyle";
import { BLOB_SVG_HEIGHT, BLOB_SVG_WIDTH, blobSvgDataUrl, renderBlobSvg } from "./blobSvg";

describe("blobStyle model", () => {
  it("expose le style par défaut bleu ciel sans accessoires", () => {
    expect(DEFAULT_BLOB_STYLE).toEqual({ color: "sky", glasses: "none", hat: "none" });
    expect(BLOB_COLOR_HEX.sky).toBe("#54B7E5");
  });

  it("valide toutes les combinaisons valides et ignore les propriétés superflues", () => {
    for (const color of BLOB_COLORS) {
      for (const glasses of BLOB_GLASSES) {
        for (const hat of BLOB_HATS) {
          expect(parseBlobStyle({ color, glasses, hat, extra: "ignored" })).toEqual({ color, glasses, hat });
        }
      }
    }
  });

  it("rejette les valeurs invalides, nulles ou incomplètes", () => {
    expect(parseBlobStyle(null)).toBeNull();
    expect(parseBlobStyle(undefined)).toBeNull();
    expect(parseBlobStyle("sky")).toBeNull();
    expect(parseBlobStyle([])).toBeNull();
    expect(parseBlobStyle({ color: "sky", glasses: "none" })).toBeNull();
    expect(parseBlobStyle({ color: "neon", glasses: "none", hat: "none" })).toBeNull();
    expect(parseBlobStyle({ color: "sky", glasses: "monocle", hat: "none" })).toBeNull();
    expect(parseBlobStyle({ color: "sky", glasses: "none", hat: "helmet" })).toBeNull();
    expect(parseBlobStyle({ color: 123, glasses: "none", hat: "none" })).toBeNull();
  });

  it("compare et génère une clé stable", () => {
    const a = { color: "coral" as const, glasses: "shades" as const, hat: "cap" as const };
    const b = { color: "coral" as const, glasses: "shades" as const, hat: "cap" as const };
    expect(blobStyleEquals(a, b)).toBe(true);
    expect(blobStyleEquals(a, DEFAULT_BLOB_STYLE)).toBe(false);
    expect(blobStyleKey(a)).toBe("coral:shades:cap");
  });
});

describe("renderBlobSvg", () => {
  it("respecte la silhouette et les couleurs d'origine pour DEFAULT_BLOB_STYLE", () => {
    const svg = renderBlobSvg(DEFAULT_BLOB_STYLE);
    expect(svg).toContain(`viewBox="0 0 ${BLOB_SVG_WIDTH} ${BLOB_SVG_HEIGHT}"`);
    expect(svg).toContain('fill="#54B7E5"');
    expect(svg).toContain('stroke="#293C49"');
    expect(svg).not.toContain('id="Glasses-');
    expect(svg).not.toContain('id="Hat-');
  });

  it("combine couleur, lunettes et couvre-chef dans un SVG valide encodé en data URL", () => {
    const style = { color: "mint" as const, glasses: "star" as const, hat: "cap" as const };
    const svg = renderBlobSvg(style);
    expect(svg).toContain(`fill="${BLOB_COLOR_HEX.mint}"`);
    expect(svg).toContain('id="Glasses-star"');
    expect(svg).toContain('id="Hat-cap"');

    const url = blobSvgDataUrl(style);
    expect(url.startsWith("data:image/svg+xml;charset=utf-8,")).toBe(true);
    expect(decodeURIComponent(url.slice("data:image/svg+xml;charset=utf-8,".length))).toBe(svg);
  });
});
