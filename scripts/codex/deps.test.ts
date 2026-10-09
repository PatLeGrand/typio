import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, statSync, symlinkSync, utimesSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanDependencyModels, copyDependencies, dependencyHash, ensureDependencyModel, pruneDependencyModels } from "./deps";
import { UnavailableError } from "./errors";

const temps: string[] = [];

function tempDir(): string {
  const directory = realpathSync.native(mkdtempSync(path.join(os.tmpdir(), "typio-codex-deps-")));
  temps.push(directory);
  return directory;
}

function project(lock = "lock-a"): string {
  const directory = tempDir();
  writeFileSync(path.join(directory, "package.json"), '{ "name": "deps-test" }\n');
  writeFileSync(path.join(directory, "bun.lock"), lock);
  return directory;
}

function installWithModule(cwd: string): { status: number; output: string } {
  mkdirSync(path.join(cwd, "node_modules", "package"), { recursive: true });
  writeFileSync(path.join(cwd, "node_modules", "package", "index.js"), "module.exports = 1;\n");
  return { status: 0, output: "" };
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const directory of temps.splice(0)) rmSync(directory, { recursive: true, force: true, maxRetries: 3 });
});

describe("nettoyage des modèles de dépendances", () => {
  it("supprime les temporaires vieux de plus d'une heure, sans toucher aux récents ni aux modèles complets", () => {
    const state = tempDir();
    const deps = path.join(state, "deps");
    mkdirSync(deps);
    const stale = path.join(deps, `${"a".repeat(64)}.tmp-x`);
    const recent = path.join(deps, `${"b".repeat(64)}.tmp-x`);
    const complete = path.join(deps, "c".repeat(64));
    mkdirSync(stale);
    mkdirSync(recent);
    mkdirSync(path.join(complete, "node_modules"), { recursive: true });
    writeFileSync(path.join(complete, ".complet"), "ok\n");
    const old = new Date(Date.now() - 60 * 60_000 - 1);
    utimesSync(stale, old, old);

    pruneDependencyModels(state);

    expect(existsSync(stale)).toBe(false);
    expect(existsSync(recent)).toBe(true);
    expect(existsSync(complete)).toBe(true);
  });

  it("laisse en place, avec un avertissement, les liens nommés comme une empreinte, sans supprimer leur cible", (context) => {
    const warn = vi.spyOn(console, "error").mockImplementation(() => {});
    const state = tempDir();
    const deps = path.join(state, "deps");
    const target = path.join(tempDir(), "model-target");
    mkdirSync(deps);
    mkdirSync(target);
    const targetFile = path.join(target, "do-not-delete");
    writeFileSync(targetFile, "ok\n");

    for (const operation of [pruneDependencyModels, cleanDependencyModels]) {
      const hash = operation === pruneDependencyModels ? "a".repeat(64) : "b".repeat(64);
      const link = path.join(deps, hash);
      try {
        symlinkSync(target, link, "junction");
      } catch (error) {
        if (["EPERM", "EACCES"].includes((error as NodeJS.ErrnoException).code ?? "")) {
          context.skip();
          return;
        }
        throw error;
      }

      expect(() => operation(state)).not.toThrow();
      expect(existsSync(targetFile)).toBe(true);
      expect(existsSync(link)).toBe(true);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("n'est pas un dossier de modèle"));
      rmSync(link);
    }
  });

  it("un fichier nommé comme une empreinte n'interrompt pas le nettoyage des vrais modèles", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const state = tempDir();
    const deps = path.join(state, "deps");
    mkdirSync(deps);
    writeFileSync(path.join(deps, "d".repeat(64)), "pas un dossier\n");
    const model = path.join(deps, "e".repeat(64));
    mkdirSync(path.join(model, "node_modules"), { recursive: true });
    writeFileSync(path.join(model, ".complet"), "ok\n");

    expect(() => cleanDependencyModels(state)).not.toThrow();
    expect(existsSync(model)).toBe(false);
  });

  // robocopy (injectable) n'est utilisé que sous Windows ; ailleurs, la copie passe par cpSync.
  it.runIf(process.platform === "win32")("marque le modèle utilisé avant de le copier, pour qu'un nettoyage concurrent ne le supprime pas", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const state = tempDir();
    const directory = project("lock-utilise");
    const model = ensureDependencyModel(directory, state, { install: installWithModule });
    const used = path.join(model, ".utilise");
    const old = new Date(Date.now() - 24 * 60 * 60_000);
    utimesSync(used, old, old);
    let markedBeforeCopy = false;
    copyDependencies(directory, state, {
      robocopy: (source, destination) => {
        markedBeforeCopy = Date.now() - statSync(used).mtimeMs < 60_000;
        cpSync(source, destination, { recursive: true });
        return { status: 1, output: "" };
      },
    });
    expect(markedBeforeCopy).toBe(true);
  });
});

describe("modèles de dépendances", () => {
  it("construit un modèle absent une fois, puis réutilise l'empreinte du bun.lock", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const source = project();
    const state = tempDir();
    const install = vi.fn(installWithModule);
    const first = ensureDependencyModel(source, state, { install });
    const second = ensureDependencyModel(source, state, { install });
    expect(first).toBe(second);
    expect(install).toHaveBeenCalledTimes(1);
    expect(readFileSync(path.join(first, ".complet"), "utf8")).toBe("ok\n");
    expect(path.basename(first)).toBe(dependencyHash(path.join(source, "bun.lock")));
  });

  it("reconstruit un modèle incomplet et garde le modèle déjà finalisé par un concurrent", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const source = project();
    const state = tempDir();
    const hash = dependencyHash(path.join(source, "bun.lock"));
    const stale = path.join(state, "deps", hash);
    mkdirSync(path.join(stale, "node_modules"), { recursive: true });
    const install = vi.fn((cwd: string) => {
      const result = installWithModule(cwd);
      const winner = path.join(state, "deps", hash);
      if (!existsSync(winner)) {
        mkdirSync(path.join(winner, "node_modules"), { recursive: true });
        writeFileSync(path.join(winner, "node_modules", "winner.js"), "ok\n");
        writeFileSync(path.join(winner, ".complet"), "ok\n");
      }
      return result;
    });
    const model = ensureDependencyModel(source, state, { install });
    expect(install).toHaveBeenCalledTimes(1);
    expect(existsSync(path.join(model, ".complet"))).toBe(true);
    expect(existsSync(path.join(model, "node_modules", "winner.js"))).toBe(true);
  });

  it("copie avec robocopy : 0 à 7 réussissent, 8 est indisponible, sans lien vers le modèle", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const source = project();
    const state = tempDir();
    const target = project();
    const robocopy = vi.fn((from: string, to: string) => {
      cpSync(from, to, { recursive: true, dereference: false });
      return { status: 7, output: "" };
    });
    copyDependencies(source, state, { install: installWithModule });
    copyDependencies(target, state, { robocopy });
    expect(robocopy).toHaveBeenCalledTimes(1);
    expect(existsSync(path.join(target, "node_modules", "package", "index.js"))).toBe(true);
    expect(realpathSync.native(path.join(target, "node_modules"))).not.toBe(realpathSync.native(robocopy.mock.calls[0]?.[0] ?? ""));
    expect(() => copyDependencies(project(), state, { robocopy: () => ({ status: 8, output: "échec" }) })).toThrow(UnavailableError);
  });

  it("garde les trois modèles les plus récemment utilisés et clean ne suit pas une jonction", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const state = tempDir();
    const deps = path.join(state, "deps");
    mkdirSync(deps);
    mkdirSync(path.join(deps, "ne-pas-supprimer"));
    const hashes = Array.from({ length: 4 }, (_, index) => `${index}`.repeat(64));
    for (const [index, hash] of hashes.entries()) {
      const model = path.join(deps, hash);
      mkdirSync(path.join(model, "node_modules"), { recursive: true });
      writeFileSync(path.join(model, ".complet"), "ok\n");
      writeFileSync(path.join(model, ".utilise"), "x\n");
      const time = new Date(1_000 + index * 1_000);
      utimesSync(path.join(model, ".utilise"), time, time);
    }
    pruneDependencyModels(state);
    expect(hashes.filter((hash) => existsSync(path.join(deps, hash)))).toEqual(hashes.slice(1));
    // La jonction vise un dossier hors de deps/ : clean la laisse en place, sans rien supprimer de sa cible.
    const outside = tempDir();
    writeFileSync(path.join(outside, "garde.txt"), "ok\n");
    const link = path.join(deps, "a".repeat(64));
    symlinkSync(outside, link, "junction");
    expect(() => cleanDependencyModels(state)).not.toThrow();
    expect(existsSync(link)).toBe(true);
    expect(existsSync(path.join(outside, "garde.txt"))).toBe(true);
    expect(hashes.filter((hash) => existsSync(path.join(deps, hash)))).toEqual([]);
    rmSync(link);
    expect(existsSync(path.join(deps, "ne-pas-supprimer"))).toBe(true);
  });
});
