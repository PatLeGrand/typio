import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { findHardcodedColors } from "./hardcodedColors";

/** Fichiers source (hors tests) d'un dossier, récursivement. */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

describe("couleurs des composants et des pages", () => {
  const files = [
    ...sourceFiles(join(process.cwd(), "src/components")),
    ...sourceFiles(join(process.cwd(), "src/app/[lang]")),
  ];

  it("trouve des fichiers à vérifier", () => {
    expect(files.length).toBeGreaterThan(5);
  });

  it.each(files.map((file) => [file.slice(process.cwd().length + 1), file]))(
    "%s n'a aucune couleur en dur (tout passe par les tokens)",
    (_name, file) => {
      expect(findHardcodedColors(readFileSync(file, "utf8"))).toEqual([]);
    },
  );
});
