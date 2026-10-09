import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { collectChanges } from "./collect";
import { TamperedWorkError, UnavailableError, UsageError } from "./errors";
import { cleanWorkdir, extractBase, extractCommit, judgeFailedWork, prepareWorkdir } from "./workdir";

// Ces tests montent de vrais dépôts git : sous la charge de la suite complète, ils dépassent les 5 s par défaut.
vi.setConfig({ testTimeout: 30_000 });

const temps: string[] = [];

function tempDir(): string {
  const dir = realpathSync.native(mkdtempSync(path.join(os.tmpdir(), "typio-codex-workdir-")));
  temps.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
});

function git(cwd: string, ...args: string[]): string {
  const result = spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...args], { cwd, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} : ${result.stderr}`);
  return result.stdout;
}

function makeRepo(): string {
  const dir = tempDir();
  git(dir, "init", "-q", "-b", "main");
  writeFileSync(path.join(dir, ".gitignore"), ".env*\n!.env.example\nnode_modules\n");
  writeFileSync(path.join(dir, "a.txt"), "a\n");
  mkdirSync(path.join(dir, "docs"));
  writeFileSync(path.join(dir, "docs", "b.md"), "b\n");
  writeFileSync(path.join(dir, ".env.example"), "DATABASE_URL=\n");
  git(dir, "add", ".");
  git(dir, "commit", "-q", "-m", "init");
  return dir;
}

// `git archive` applique les conversions de fin de ligne du dépôt (core.autocrlf) : on compare au texte normalisé.
const text = (file: string): string => readFileSync(file, "utf8").replace(/\r\n/g, "\n");

function listFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.relative(dir, path.join(entry.parentPath, entry.name)).replaceAll("\\", "/"))
    .sort();
}

describe("prepareWorkdir et extractBase : src/ au départ, base/ après Codex", () => {
  it("src/ d'abord, base/ ensuite, identiques, sans .git, sans rien de non versionné", () => {
    const repo = makeRepo();
    // Ni les modifications non commitées, ni les fichiers non suivis, ni les secrets ignorés n'y passent.
    writeFileSync(path.join(repo, "a.txt"), "modifié, non commité\n");
    writeFileSync(path.join(repo, "non-suivi.txt"), "x\n");
    writeFileSync(path.join(repo, ".env.local"), "SECRET=1\n");
    const parent = tempDir();
    const work = prepareWorkdir(repo, git(repo, "rev-parse", "HEAD").trim(), parent);

    expect(path.dirname(work.dir)).toBe(parent);
    expect(work.base).toBe(path.join(work.dir, "base"));
    expect(work.src).toBe(path.join(work.dir, "src"));
    const expected = [".env.example", ".gitignore", "a.txt", "docs/b.md"];
    // Au départ, seul src/ existe : la référence n'est pas à portée de Codex.
    expect(existsSync(work.base)).toBe(false);
    extractBase(repo, git(repo, "rev-parse", "HEAD").trim(), work);
    expect(listFiles(work.base)).toEqual(expected);
    expect(listFiles(work.src)).toEqual(expected);
    expect(text(path.join(work.src, "a.txt"))).toBe("a\n");
    expect(existsSync(path.join(work.base, ".git"))).toBe(false);
    expect(existsSync(path.join(work.src, ".git"))).toBe(false);
    // Intactes et identiques : rien à reporter.
    expect(collectChanges(work.base, work.src, () => new Set())).toEqual({ added: [], modified: [], deleted: [], ignored: [] });
  });

  it("extractBase : la référence est neuve même si Codex a tout changé, y compris un base/ forgé", () => {
    const repo = makeRepo();
    const commit = git(repo, "rev-parse", "HEAD").trim();
    const work = prepareWorkdir(repo, commit, tempDir());
    writeFileSync(path.join(work.src, "a.txt"), "changé par Codex\n");
    writeFileSync(path.join(work.src, ".env.local"), "SECRET=1\n");
    // Un base/ forgé pour masquer les changements de src/ est écrasé.
    mkdirSync(work.base);
    writeFileSync(path.join(work.base, "a.txt"), "changé par Codex\n");
    writeFileSync(path.join(work.base, ".env.local"), "SECRET=1\n");
    extractBase(repo, commit, work);
    expect(text(path.join(work.base, "a.txt"))).toBe("a\n");
    expect(existsSync(path.join(work.base, ".env.local"))).toBe(false);
    // Avec le base/ forgé, le .env.local de src/ serait passé pour « déjà présent » ; avec la vraie référence, ALERTE.
    expect(() => collectChanges(work.base, work.src, () => new Set())).toThrow(TamperedWorkError);
  });

  it("part du commit donné, pas de HEAD", () => {
    const repo = makeRepo();
    const first = git(repo, "rev-parse", "HEAD").trim();
    writeFileSync(path.join(repo, "a.txt"), "v2\n");
    git(repo, "commit", "-qam", "v2");
    const work = prepareWorkdir(repo, first, tempDir());
    expect(text(path.join(work.src, "a.txt"))).toBe("a\n");
  });

  it("un commit inconnu est un Codex indisponible, et ne laisse aucun dossier", () => {
    const repo = makeRepo();
    const parent = tempDir();
    expect(() => prepareWorkdir(repo, "0".repeat(40), parent)).toThrow(UnavailableError);
    expect(readdirSync(parent)).toEqual([]);
  });

  it("extractCommit : le dossier de destination est le dossier courant de tar, jamais un argument", () => {
    const repo = makeRepo();
    const dest = path.join(tempDir(), "d");
    extractCommit(repo, "HEAD", [dest]);
    expect(listFiles(dest)).toContain("a.txt");
  });
});

describe("judgeFailedWork : garder le travail partiel après un échec de Codex", () => {
  const none = () => new Set<string>();

  function setup() {
    const repo = makeRepo();
    const commit = git(repo, "rev-parse", "HEAD").trim();
    return { repo, commit, work: prepareWorkdir(repo, commit, tempDir()) };
  }

  it("aucun changement dans src : pas de raison de garder", () => {
    const { repo, commit, work } = setup();
    expect(judgeFailedWork(repo, commit, work, none).keep).toBe(false);
  });

  it("un changement (ajout, modification ou suppression) : on garde", () => {
    for (const change of [
      (src: string) => writeFileSync(path.join(src, "nouveau.md"), "n\n"),
      (src: string) => writeFileSync(path.join(src, "a.txt"), "autre\n"),
      (src: string) => rmSync(path.join(src, "a.txt")),
    ]) {
      const { repo, commit, work } = setup();
      change(work.src);
      expect(judgeFailedWork(repo, commit, work, none)).toMatchObject({ keep: true });
    }
  });

  it("seuls des fichiers ignorés ou node_modules/ : rien à garder", () => {
    const { repo, commit, work } = setup();
    mkdirSync(path.join(work.src, "node_modules", "p"), { recursive: true });
    writeFileSync(path.join(work.src, "node_modules", "p", "i.js"), "x\n");
    writeFileSync(path.join(work.src, "debug.log"), "x\n");
    expect(judgeFailedWork(repo, commit, work, (paths) => new Set(paths)).keep).toBe(false);
  });

  it("un travail piégé lève l'ALERTE au lieu de l'échec", () => {
    const { repo, commit, work } = setup();
    mkdirSync(path.join(work.src, "evil", ".git"), { recursive: true });
    writeFileSync(path.join(work.src, "evil", ".git", "config"), "x\n");
    expect(() => judgeFailedWork(repo, commit, work, none)).toThrow(TamperedWorkError);
  });

  it("si on ne peut pas savoir (extraction ou collecte en échec), on garde par prudence", () => {
    const { repo, work } = setup();
    const verdict = judgeFailedWork(repo, "0".repeat(40), work, none);
    expect(verdict.keep).toBe(true);
    expect(verdict.reason).toContain("impossible de savoir");
    const { repo: repo2, commit, work: work2 } = setup();
    writeFileSync(path.join(work2.src, "nouveau.md"), "n\n");
    const failing = () => {
      throw new UnavailableError("git check-ignore : boum");
    };
    expect(judgeFailedWork(repo2, commit, work2, failing).keep).toBe(true);
  });
});

describe("cleanWorkdir : clean --work", () => {
  function makeWorkParent(): { parent: string; id: string; dir: string } {
    const parent = tempDir();
    const work = prepareWorkdir(makeRepo(), "HEAD", parent);
    return { parent, id: work.id, dir: work.dir };
  }

  it("supprime le dossier work, rien d'autre", () => {
    const { parent, id, dir } = makeWorkParent();
    const voisin = path.join(parent, "voisin");
    mkdirSync(voisin);
    expect(cleanWorkdir(id, parent)).toBe(dir);
    expect(existsSync(dir)).toBe(false);
    expect(existsSync(voisin)).toBe(true);
  });

  it("supprime un dossier contenant un dépôt git imbriqué aux fichiers en lecture seule", () => {
    const { parent, id, dir } = makeWorkParent();
    const evil = path.join(dir, "src", "evil");
    mkdirSync(evil);
    git(evil, "init", "-q", "-b", "main");
    writeFileSync(path.join(evil, "f.txt"), "x\n");
    git(evil, "add", "f.txt");
    git(evil, "commit", "-qm", "x");
    cleanWorkdir(id, parent);
    expect(existsSync(dir)).toBe(false);
  });

  it("ne suit pas une jonction posée dans src : la cible reste intacte", () => {
    const { parent, id, dir } = makeWorkParent();
    const outside = tempDir();
    writeFileSync(path.join(outside, "precieux.txt"), "à garder\n");
    symlinkSync(outside, path.join(dir, "src", "lien"), "junction");
    cleanWorkdir(id, parent);
    expect(existsSync(dir)).toBe(false);
    expect(readFileSync(path.join(outside, "precieux.txt"), "utf8")).toBe("à garder\n");
  });

  it.each(["", "..", "../x", "a/b", "a\\b", ".", "-x", "C:\\Windows", "run-a/../../x"])("refuse l'identifiant %j", (id) => {
    expect(() => cleanWorkdir(id, tempDir())).toThrow(UsageError);
  });

  it("refuse un identifiant inconnu", () => {
    expect(() => cleanWorkdir("run-inconnu", tempDir())).toThrow(/Aucun dossier work/);
    expect(() => cleanWorkdir("run-inconnu", path.join(tempDir(), "absent"))).toThrow(UsageError);
  });

  it("refuse un fichier ordinaire et un lien vers un dossier extérieur, sans rien supprimer", () => {
    const parent = tempDir();
    writeFileSync(path.join(parent, "fichier"), "x");
    expect(() => cleanWorkdir("fichier", parent)).toThrow(UsageError);
    const outside = tempDir();
    writeFileSync(path.join(outside, "precieux.txt"), "x");
    symlinkSync(outside, path.join(parent, "lien"), "junction");
    expect(() => cleanWorkdir("lien", parent)).toThrow(UsageError);
    expect(existsSync(path.join(outside, "precieux.txt"))).toBe(true);
  });
});
