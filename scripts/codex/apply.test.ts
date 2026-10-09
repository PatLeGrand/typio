import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, statSync, symlinkSync, utimesSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { applyChanges, summarizeAdded } from "./apply";
import { collectChanges } from "./collect";
import { UnavailableError } from "./errors";
import { createWorktree, diffStat, statusLines } from "./worktree";

const temps: string[] = [];

function tempDir(): string {
  const dir = realpathSync.native(mkdtempSync(path.join(os.tmpdir(), "typio-codex-apply-")));
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

function put(root: string, files: Record<string, string>): void {
  for (const [rel, content] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    writeFileSync(path.join(root, rel), content);
  }
}

const FILES = { "a.txt": "a\n", "docs/b.md": "b\n", "docs/deep/c.md": "c\n", "keep.txt": "k\n" };

/** Un vrai dépôt, son worktree neuf, et un `src` identique au commit où Codex a travaillé. */
function setup() {
  const repo = tempDir();
  git(repo, "init", "-q", "-b", "main");
  put(repo, FILES);
  git(repo, "add", ".");
  git(repo, "commit", "-q", "-m", "init");
  const worktree = createWorktree(repo, "codex/implement-1", "HEAD", tempDir());
  const base = path.join(tempDir(), "base");
  const src = path.join(tempDir(), "src");
  put(base, FILES);
  put(src, FILES);
  return { repo, worktree, base, src };
}

describe("applyChanges : le worktree neuf ne reçoit que les fichiers changés", () => {
  it("AC-4 : ajout, modification et suppression arrivent ; le reste n'est pas touché", () => {
    const { worktree, base, src } = setup();
    put(src, { "docs/nouveau.md": "n\n", "a.txt": "a modifié\n" });
    rmSync(path.join(src, "keep.txt"));
    // Ce fichier n'a pas changé : s'il était recopié, sa date de modification changerait.
    const stale = path.join(worktree.path, "docs", "b.md");
    const mtime = new Date(2020, 0, 1);
    utimesSync(stale, mtime, mtime);

    const changes = collectChanges(base, src, () => new Set());
    applyChanges(src, worktree.path, changes);

    expect(readFileSync(path.join(worktree.path, "docs", "nouveau.md"), "utf8")).toBe("n\n");
    expect(readFileSync(path.join(worktree.path, "a.txt"), "utf8")).toBe("a modifié\n");
    expect(existsSync(path.join(worktree.path, "keep.txt"))).toBe(false);
    expect(statSync(stale).mtime.getFullYear()).toBe(2020);
    expect(statusLines(worktree.path).sort()).toEqual([" M a.txt", " D keep.txt", "?? docs/nouveau.md"].sort());
  });

  it("AC-4 : rien n'a changé, rien à reporter", () => {
    const { worktree, base, src } = setup();
    const changes = collectChanges(base, src, () => new Set());
    applyChanges(src, worktree.path, changes);
    expect(statusLines(worktree.path)).toEqual([]);
  });

  it("les fichiers ignorés listés ne sont pas copiés", () => {
    const { worktree, base, src } = setup();
    put(src, { "dist/x.js": "x\n", "docs/n.md": "n\n" });
    const changes = collectChanges(base, src, (paths) => new Set(paths.filter((rel) => rel.startsWith("dist/"))));
    applyChanges(src, worktree.path, changes);
    expect(existsSync(path.join(worktree.path, "dist"))).toBe(false);
    expect(existsSync(path.join(worktree.path, "docs", "n.md"))).toBe(true);
  });

  it("supprime les dossiers laissés vides, sans toucher à ceux qui ont encore des fichiers", () => {
    const { worktree, base, src } = setup();
    rmSync(path.join(src, "docs", "deep"), { recursive: true });
    applyChanges(src, worktree.path, collectChanges(base, src, () => new Set()));
    expect(existsSync(path.join(worktree.path, "docs", "deep"))).toBe(false);
    expect(existsSync(path.join(worktree.path, "docs", "b.md"))).toBe(true);
  });

  it("un fichier qui devient un dossier, et un dossier qui devient un fichier", () => {
    const { worktree, base, src } = setup();
    rmSync(path.join(src, "a.txt"));
    put(src, { "a.txt/dedans.md": "d\n" });
    rmSync(path.join(src, "docs", "deep"), { recursive: true });
    put(src, { "docs/deep": "fichier\n" });
    applyChanges(src, worktree.path, collectChanges(base, src, () => new Set()));
    expect(readFileSync(path.join(worktree.path, "a.txt", "dedans.md"), "utf8")).toBe("d\n");
    expect(readFileSync(path.join(worktree.path, "docs", "deep"), "utf8")).toBe("fichier\n");
  });

  it("refuse d'écrire à travers un lien présent dans le worktree", () => {
    const { worktree, base, src } = setup();
    const outside = tempDir();
    rmSync(path.join(worktree.path, "docs"), { recursive: true });
    symlinkSync(outside, path.join(worktree.path, "docs"), "junction");
    put(src, { "docs/nouveau.md": "n\n" });
    const changes = collectChanges(base, src, () => new Set());
    expect(() => applyChanges(src, worktree.path, changes)).toThrow(UnavailableError);
    expect(existsSync(path.join(outside, "nouveau.md"))).toBe(false);
  });

  it("refuse un chemin qui sortirait du worktree", () => {
    const { worktree, src } = setup();
    const changes = { added: ["../evasion.txt"], modified: [], deleted: [], ignored: [] };
    expect(() => applyChanges(src, worktree.path, changes)).toThrow(UnavailableError);
    expect(existsSync(path.join(path.dirname(worktree.path), "evasion.txt"))).toBe(false);
  });

  it("le rapport voit les fichiers nouveaux malgré l'absence de git add -N", () => {
    const { worktree, base, src } = setup();
    put(src, { "docs/nouveau.md": "une\ndeux\n", "vide.txt": "", "a.txt": "a modifié\n" });
    const changes = collectChanges(base, src, () => new Set());
    applyChanges(src, worktree.path, changes);
    const stat = diffStat(worktree);
    expect(stat).toContain("a.txt");
    expect(stat).not.toContain("nouveau.md");
    const added = summarizeAdded(worktree.path, changes.added);
    expect(added).toContain(" docs/nouveau.md | 2 +");
    expect(added).toContain(" vide.txt | 0 +");
    expect(git(worktree.path, "diff", "--cached", "--name-only").trim()).toBe("");
  });
});

describe("applyChanges : le contenu, pas le fichier", () => {
  // Les flux NTFS secondaires (`fichier:flux`) n'existent que sous Windows.
  it.skipIf(process.platform !== "win32")("F-4 : un flux NTFS secondaire n'est pas emporté dans le worktree", () => {
    const { worktree, base, src } = setup();
    put(src, { "docs/nouveau.md": "visible\n" });
    writeFileSync(path.join(src, "docs", "nouveau.md") + ":cache", "caché\n");
    expect(readFileSync(path.join(src, "docs", "nouveau.md") + ":cache", "utf8")).toBe("caché\n");
    applyChanges(src, worktree.path, collectChanges(base, src, () => new Set()));
    expect(readFileSync(path.join(worktree.path, "docs", "nouveau.md"), "utf8")).toBe("visible\n");
    expect(() => readFileSync(path.join(worktree.path, "docs", "nouveau.md") + ":cache", "utf8")).toThrow();
  });

  it("copie bien le contenu d'un fichier binaire", () => {
    const { worktree, base, src } = setup();
    const bytes = Buffer.from([0, 1, 2, 255, 254, 0, 13, 10]);
    put(src, { "docs/image.bin": bytes as unknown as string });
    applyChanges(src, worktree.path, collectChanges(base, src, () => new Set()));
    expect(readFileSync(path.join(worktree.path, "docs", "image.bin")).equals(bytes)).toBe(true);
  });
});

