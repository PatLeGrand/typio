import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanDependencyModels,
  copyDependencies,
  copyExistingModel,
  dependencyHash,
  ensureDependencyModel,
  pruneDependencyModels,
  removeAllDependencyModels,
} from "./deps";
import { UnavailableError } from "./errors";

const temps: string[] = [];

function tempDir(): string {
  const directory = realpathSync.native(mkdtempSync(path.join(os.tmpdir(), "typio-codex-deps-")));
  temps.push(directory);
  return directory;
}

function project(lock = "lock-a", packageJson = '{ "name": "deps-test" }\n'): string {
  const directory = tempDir();
  writeFileSync(path.join(directory, "package.json"), packageJson);
  writeFileSync(path.join(directory, "bun.lock"), lock);
  return directory;
}

function installWithModule(cwd: string): { status: number; output: string } {
  mkdirSync(path.join(cwd, "node_modules", "package"), { recursive: true });
  writeFileSync(path.join(cwd, "node_modules", "package", "index.js"), "module.exports = 1;\n");
  return { status: 0, output: "" };
}

/** Un faux robocopy : copie récursive, code 1 (« fichiers copiés »). Ailleurs que sous Windows, il n'est pas appelé. */
const fakeRobocopy = (source: string, destination: string): { status: number; output: string } => {
  cpSync(source, destination, { recursive: true });
  return { status: 1, output: "" };
};

/** Un modèle complet à la main sous `state/deps/<nom>`. */
function putModel(state: string, name: string, usedAt?: Date): string {
  const model = path.join(state, "deps", name);
  mkdirSync(path.join(model, "node_modules"), { recursive: true });
  writeFileSync(path.join(model, ".complet"), "ok\n");
  writeFileSync(path.join(model, ".utilise"), "x\n");
  if (usedAt) utimesSync(path.join(model, ".utilise"), usedAt, usedAt);
  return model;
}

/** Crée une jonction (un lien symbolique ailleurs que sous Windows) ; rend false si l'environnement l'interdit. */
function tryLink(target: string, link: string): boolean {
  try {
    symlinkSync(target, link, "junction");
    return true;
  } catch (error) {
    if (["EPERM", "EACCES"].includes((error as NodeJS.ErrnoException).code ?? "")) return false;
    throw error;
  }
}

const minutesAgo = (minutes: number): Date => new Date(Date.now() - minutes * 60_000);

afterEach(() => {
  vi.restoreAllMocks();
  for (const directory of temps.splice(0)) rmSync(directory, { recursive: true, force: true, maxRetries: 3 });
});

describe("empreinte d'un modèle", () => {
  it("change si package.json ou bunfig.toml change, même avec le même bun.lock", () => {
    const base = dependencyHash(project("lock-a"));
    expect(dependencyHash(project("lock-a"))).toBe(base);
    expect(base).toMatch(/^[a-f0-9]{64}$/);

    expect(dependencyHash(project("lock-a", '{ "name": "autre" }\n'))).not.toBe(base);

    const withBunfig = project("lock-a");
    writeFileSync(path.join(withBunfig, "bunfig.toml"), "[install]\nregistry = \"https://exemple.test\"\n");
    const bunfigHash = dependencyHash(withBunfig);
    expect(bunfigHash).not.toBe(base);
    writeFileSync(path.join(withBunfig, "bunfig.toml"), "[install]\nregistry = \"https://autre.test\"\n");
    expect(dependencyHash(withBunfig)).not.toBe(bunfigHash);
  });

  it("change si bun.lock change, et le nom et la taille évitent les collisions par concaténation", () => {
    expect(dependencyHash(project("lock-a"))).not.toBe(dependencyHash(project("lock-b")));
    // Même concaténation « abc » de package.json et bun.lock, répartie autrement.
    expect(dependencyHash(project("c", "ab"))).not.toBe(dependencyHash(project("bc", "a")));
  });

  it("refuse un dossier sans package.json ou sans bun.lock", () => {
    const directory = project();
    rmSync(path.join(directory, "bun.lock"));
    expect(() => dependencyHash(directory)).toThrow(UnavailableError);
  });
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
      if (!tryLink(target, link)) {
        context.skip();
        return;
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
    const model = putModel(state, "e".repeat(64));

    expect(() => cleanDependencyModels(state)).not.toThrow();
    expect(existsSync(model)).toBe(false);
  });

  it("reconnaît une empreinte en majuscules : clean la supprime", () => {
    const state = tempDir();
    const upper = putModel(state, "A".repeat(64));
    cleanDependencyModels(state);
    expect(existsSync(upper)).toBe(false);
  });

  it("garde un quatrième modèle utilisé il y a moins de 30 minutes, et supprime les plus vieux", () => {
    const state = tempDir();
    const recent = [1, 2, 3, 10].map((minutes, index) => putModel(state, `${index + 1}`.repeat(64), minutesAgo(minutes)));
    const old = putModel(state, "9".repeat(64), minutesAgo(60));
    pruneDependencyModels(state);
    expect(recent.map((model) => existsSync(model))).toEqual([true, true, true, true]);
    expect(existsSync(old)).toBe(false);
  });

  it("une erreur de suppression (EBUSY) est un avertissement, sans lever, et le ménage continue", () => {
    const warn = vi.spyOn(console, "error").mockImplementation(() => {});
    const state = tempDir();
    const models = Array.from({ length: 5 }, (_, index) => putModel(state, `${index}`.repeat(64), minutesAgo(60 + index)));
    const remove = vi.fn((candidate: string) => {
      if (candidate === models[3]) throw Object.assign(new Error("EBUSY: resource busy or locked"), { code: "EBUSY" });
      rmSync(candidate, { recursive: true, force: true });
    });
    expect(() => pruneDependencyModels(state, 3, remove)).not.toThrow();
    // Le 4e est verrouillé, le 5e est quand même supprimé.
    expect(remove).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("AVERTISSEMENT"));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("EBUSY"));
    expect(existsSync(models[3] ?? "")).toBe(true);
    expect(existsSync(models[4] ?? "")).toBe(false);
  });
});

describe("suppression totale de state/deps", () => {
  it("supprime tout le dossier, modèle en majuscules et entrées étrangères compris", () => {
    const state = tempDir();
    putModel(state, "a".repeat(64));
    putModel(state, "B".repeat(64));
    mkdirSync(path.join(state, "deps", "autre"));
    removeAllDependencyModels(state);
    expect(existsSync(path.join(state, "deps"))).toBe(false);
  });

  it("ne fait rien s'il n'y a pas de state/deps", () => {
    expect(() => removeAllDependencyModels(tempDir())).not.toThrow();
  });

  it("ne suit pas une jonction : seul le lien est retiré, la cible reste intacte, avec un avertissement", (context) => {
    const warn = vi.spyOn(console, "error").mockImplementation(() => {});
    const state = tempDir();
    const outside = tempDir();
    const kept = path.join(outside, "garde.txt");
    writeFileSync(kept, "ok\n");
    const model = putModel(outside, "c".repeat(64));
    // state/deps pointe vers `outside/deps`.
    if (!tryLink(path.join(outside, "deps"), path.join(state, "deps"))) {
      context.skip();
      return;
    }
    removeAllDependencyModels(state);
    expect(existsSync(path.join(state, "deps"))).toBe(false);
    expect(existsSync(kept)).toBe(true);
    expect(existsSync(path.join(model, ".complet"))).toBe(true);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("seul le lien est retiré"));
  });
});

describe("modèles de dépendances", () => {
  it("construit un modèle absent une fois, puis réutilise l'empreinte", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const source = project();
    const state = tempDir();
    const install = vi.fn(installWithModule);
    const first = ensureDependencyModel(source, state, { install });
    const second = ensureDependencyModel(source, state, { install });
    expect(first).toBe(second);
    expect(install).toHaveBeenCalledTimes(1);
    expect(readFileSync(path.join(first, ".complet"), "utf8")).toBe("ok\n");
    expect(path.basename(first)).toBe(dependencyHash(source));
  });

  it("reconstruit un modèle incomplet et garde le modèle déjà finalisé par un concurrent", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const source = project();
    const state = tempDir();
    const hash = dependencyHash(source);
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

  it("n'utilise jamais un dossier à l'empreinte en majuscules : copyExistingModel rend false, ensureDependencyModel le remplace", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const source = project();
    const state = tempDir();
    const hash = dependencyHash(source);
    const upper = putModel(state, hash.toUpperCase());
    writeFileSync(path.join(upper, "node_modules", "piege.js"), "// piégé\n");
    const target = project();
    const robocopy = vi.fn(fakeRobocopy);

    expect(copyExistingModel(target, state, { robocopy })).toBe(false);
    expect(robocopy).not.toHaveBeenCalled();
    expect(existsSync(path.join(target, "node_modules"))).toBe(false);

    const install = vi.fn(installWithModule);
    const model = ensureDependencyModel(source, state, { install });
    expect(install).toHaveBeenCalledTimes(1);
    expect(path.basename(model)).toBe(hash);
    expect(readdirSync(path.join(state, "deps"))).toEqual([hash]);
    expect(existsSync(path.join(model, "node_modules", "piege.js"))).toBe(false);
    expect(existsSync(path.join(model, "node_modules", "package", "index.js"))).toBe(true);
  });

  it("ensureDependencyModel retire seul le lien d'une entrée en majuscules qui est une jonction", (context) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const source = project();
    const state = tempDir();
    const outside = tempDir();
    const kept = path.join(outside, "garde.txt");
    writeFileSync(kept, "ok\n");
    mkdirSync(path.join(state, "deps"));
    if (!tryLink(outside, path.join(state, "deps", dependencyHash(source).toUpperCase()))) {
      context.skip();
      return;
    }
    ensureDependencyModel(source, state, { install: installWithModule });
    expect(existsSync(kept)).toBe(true);
    expect(readdirSync(path.join(state, "deps"))).toEqual([dependencyHash(source)]);
  });

  it("copyExistingModel rend false sans modèle ni state/deps, et ne construit rien", () => {
    const target = project();
    const state = tempDir();
    const robocopy = vi.fn(fakeRobocopy);
    expect(copyExistingModel(target, state, { robocopy })).toBe(false);
    expect(existsSync(path.join(state, "deps"))).toBe(false);
    mkdirSync(path.join(state, "deps"));
    expect(copyExistingModel(target, state, { robocopy })).toBe(false);
    // Un modèle incomplet (sans .complet) n'est pas utilisé non plus.
    mkdirSync(path.join(state, "deps", dependencyHash(target), "node_modules"), { recursive: true });
    expect(copyExistingModel(target, state, { robocopy })).toBe(false);
    expect(robocopy).not.toHaveBeenCalled();
  });

  it("copyExistingModel copie le modèle complet qui correspond, sans lien vers lui", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const source = project();
    const state = tempDir();
    const target = project();
    ensureDependencyModel(source, state, { install: installWithModule });
    expect(copyExistingModel(target, state, { robocopy: fakeRobocopy })).toBe(true);
    expect(readFileSync(path.join(target, "node_modules", "package", "index.js"), "utf8")).toBe("module.exports = 1;\n");
    expect(realpathSync.native(path.join(target, "node_modules"))).not.toBe(realpathSync.native(path.join(state, "deps", dependencyHash(source), "node_modules")));
  });

  it("copyExistingModel ne trouve pas de modèle si package.json diffère, même avec le même bun.lock", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const state = tempDir();
    ensureDependencyModel(project("lock-a"), state, { install: installWithModule });
    const target = project("lock-a", '{ "name": "avec-postinstall" }\n');
    expect(copyExistingModel(target, state, { robocopy: fakeRobocopy })).toBe(false);
    expect(existsSync(path.join(target, "node_modules"))).toBe(false);
  });

  // robocopy (injectable) n'est utilisé que sous Windows ; ailleurs, la copie passe par cpSync.
  it.runIf(process.platform === "win32")("copie avec robocopy : 0 à 7 réussissent, 8 est indisponible, sans lien vers le modèle", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const source = project();
    const state = tempDir();
    const target = project();
    const robocopy = vi.fn(fakeRobocopy);
    copyDependencies(source, state, { install: installWithModule, robocopy: fakeRobocopy });
    copyDependencies(target, state, { robocopy });
    expect(robocopy).toHaveBeenCalledTimes(1);
    expect(existsSync(path.join(target, "node_modules", "package", "index.js"))).toBe(true);
    expect(realpathSync.native(path.join(target, "node_modules"))).not.toBe(realpathSync.native(robocopy.mock.calls[0]?.[0] ?? ""));
    expect(() => copyDependencies(project(), state, { robocopy: () => ({ status: 8, output: "échec" }) })).toThrow(UnavailableError);
  });

  it.runIf(process.platform !== "win32")("copie avec cpSync : un lien symbolique relatif de node_modules/.bin reste relatif", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const source = project();
    const state = tempDir();
    const target = project();
    ensureDependencyModel(source, state, {
      install: (cwd) => {
        installWithModule(cwd);
        mkdirSync(path.join(cwd, "node_modules", ".bin"));
        symlinkSync("../package/index.js", path.join(cwd, "node_modules", ".bin", "outil"));
        return { status: 0, output: "" };
      },
    });
    expect(copyExistingModel(target, state)).toBe(true);
    expect(readlinkSync(path.join(target, "node_modules", ".bin", "outil"))).toBe("../package/index.js");
  });

  it("marque le modèle utilisé avant de le copier, pour qu'un ménage concurrent ne le supprime pas", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const state = tempDir();
    const directory = project("lock-utilise");
    const model = ensureDependencyModel(directory, state, { install: installWithModule });
    const used = path.join(model, ".utilise");
    utimesSync(used, minutesAgo(24 * 60), minutesAgo(24 * 60));
    let markedBeforeCopy = false;
    // Sous Windows, la copie passe par robocopy ; ailleurs, on vérifie la date juste après (le marquage précède la copie).
    const robocopy = (source: string, destination: string) => {
      markedBeforeCopy = Date.now() - statSync(used).mtimeMs < 60_000;
      return fakeRobocopy(source, destination);
    };
    expect(copyExistingModel(directory, state, { robocopy })).toBe(true);
    expect(process.platform === "win32" ? markedBeforeCopy : Date.now() - statSync(used).mtimeMs < 60_000).toBe(true);
  });

  it("un renommage qui échoue puis réussit construit quand même le modèle, avec 500 ms entre deux essais", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const source = project();
    const state = tempDir();
    const rename = vi
      .fn<(from: string, to: string) => void>()
      .mockImplementationOnce(() => {
        throw Object.assign(new Error("EBUSY: resource busy or locked, rename"), { code: "EBUSY" });
      })
      .mockImplementation(renameSync);
    const sleep = vi.fn();
    const model = ensureDependencyModel(source, state, { install: installWithModule, rename, sleep });
    expect(rename).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledWith(500);
    expect(existsSync(path.join(model, ".complet"))).toBe(true);
    expect(readdirSync(path.join(state, "deps"))).toEqual([dependencyHash(source)]);
  });

  it("après trois renommages en échec, la construction échoue (UnavailableError) et le temporaire est supprimé", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const source = project();
    const state = tempDir();
    const rename = vi.fn(() => {
      throw Object.assign(new Error("EPERM: operation not permitted, rename"), { code: "EPERM" });
    });
    const sleep = vi.fn();
    expect(() => ensureDependencyModel(source, state, { install: installWithModule, rename, sleep })).toThrow(UnavailableError);
    expect(rename).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(readdirSync(path.join(state, "deps"))).toEqual([]);
  });

  it("garde les trois modèles les plus récemment utilisés et clean ne suit pas une jonction", (context) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const state = tempDir();
    const deps = path.join(state, "deps");
    mkdirSync(deps);
    mkdirSync(path.join(deps, "ne-pas-supprimer"));
    const hashes = Array.from({ length: 4 }, (_, index) => `${index}`.repeat(64));
    for (const [index, hash] of hashes.entries()) putModel(state, hash, new Date(1_000 + index * 1_000));
    pruneDependencyModels(state);
    expect(hashes.filter((hash) => existsSync(path.join(deps, hash)))).toEqual(hashes.slice(1));
    // La jonction vise un dossier hors de deps/ : clean la laisse en place, sans rien supprimer de sa cible.
    const outside = tempDir();
    writeFileSync(path.join(outside, "garde.txt"), "ok\n");
    const link = path.join(deps, "a".repeat(64));
    if (!tryLink(outside, link)) {
      context.skip();
      return;
    }
    expect(() => cleanDependencyModels(state)).not.toThrow();
    expect(existsSync(link)).toBe(true);
    expect(existsSync(path.join(outside, "garde.txt"))).toBe(true);
    expect(hashes.filter((hash) => existsSync(path.join(deps, hash)))).toEqual([]);
    rmSync(link);
    expect(existsSync(path.join(deps, "ne-pas-supprimer"))).toBe(true);
  });
});
