import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, utimesSync, writeFileSync } from "node:fs";
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

  it("garde les trois modèles les plus récemment utilisés et clean refuse une jonction", () => {
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
    const link = path.join(deps, "a".repeat(64));
    symlinkSync(path.join(deps, hashes[1]), link, "junction");
    expect(() => cleanDependencyModels(state)).toThrow(UnavailableError);
    expect(existsSync(link)).toBe(true);
    rmSync(link);
    cleanDependencyModels(state);
    expect(existsSync(path.join(deps, "ne-pas-supprimer"))).toBe(true);
  });
});
