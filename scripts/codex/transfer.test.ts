import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { collectChanges, gitIgnoreCheck } from "./collect";
import { UnavailableError } from "./errors";
import { transferToWorktree } from "./transfer";
import { extractBase, prepareWorkdir } from "./workdir";

// Ces tests montent de vrais dépôts git : sous la charge de la suite complète, ils dépassent les 5 s par défaut.
vi.setConfig({ testTimeout: 30_000 });

const temps: string[] = [];

function tempDir(): string {
  const dir = realpathSync.native(mkdtempSync(path.join(os.tmpdir(), "typio-codex-transfer-")));
  temps.push(dir);
  return dir;
}

afterEach(() => {
  vi.restoreAllMocks();
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
  writeFileSync(path.join(dir, ".gitignore"), "dist/\n.env*\n!.env.example\n");
  writeFileSync(path.join(dir, "a.txt"), "a\n");
  mkdirSync(path.join(dir, "docs"));
  writeFileSync(path.join(dir, "docs", "b.md"), "b\n");
  writeFileSync(path.join(dir, "keep.txt"), "k\n");
  git(dir, "add", ".");
  git(dir, "commit", "-q", "-m", "init");
  return dir;
}

describe("de la copie de travail au worktree neuf", () => {
  it("AC-3 + AC-4 : seuls les fichiers changés arrivent ; les ignorés sont listés, pas reportés ; le dossier appelant ne bouge pas", () => {
    const repo = makeRepo();
    // Un fichier non commité du dossier appelant : Codex ne le voit pas, et il ne bouge pas.
    writeFileSync(path.join(repo, "brouillon.txt"), "pas à Codex\n");
    const callerBefore = git(repo, "status", "--porcelain");
    const commit = git(repo, "rev-parse", "HEAD").trim();
    const work = prepareWorkdir(repo, commit, tempDir());
    expect(existsSync(path.join(work.src, "brouillon.txt"))).toBe(false);
    expect(existsSync(work.base)).toBe(false);

    // Ce que Codex (et le lint) laissent dans src.
    writeFileSync(path.join(work.src, "a.txt"), "a modifié\n");
    rmSync(path.join(work.src, "keep.txt"));
    mkdirSync(path.join(work.src, "docs", "neuf"));
    writeFileSync(path.join(work.src, "docs", "neuf", "n.md"), "n\n");
    mkdirSync(path.join(work.src, "dist"));
    writeFileSync(path.join(work.src, "dist", "bundle.js"), "x\n");
    mkdirSync(path.join(work.src, "node_modules", "p"), { recursive: true });
    writeFileSync(path.join(work.src, "node_modules", "p", "i.js"), "x\n");

    // La référence est extraite après Codex, comme dans runWrite.
    extractBase(repo, commit, work);
    const changes = collectChanges(work.base, work.src, gitIgnoreCheck(repo));
    expect(changes).toEqual({ added: ["docs/neuf/n.md"], modified: ["a.txt"], deleted: ["keep.txt"], ignored: ["dist/bundle.js"] });

    const root = tempDir();
    const transfer = transferToWorktree({ root: repo, branch: "codex/implement-1", startCommit: commit, srcDir: work.src, changes, worktreesRoot: root });
    expect(transfer.worktree.path).toBe(path.join(root, "codex-implement-1"));
    expect(transfer.status.split(/\r?\n/).filter(Boolean).sort()).toEqual([" D keep.txt", " M a.txt", "?? docs/neuf/n.md"]);
    expect(transfer.stat).toContain("a.txt");
    expect(transfer.stat).toContain("keep.txt");
    expect(transfer.stat).toContain(" docs/neuf/n.md | 1 +");
    expect(existsSync(path.join(transfer.worktree.path, "dist"))).toBe(false);
    expect(existsSync(path.join(transfer.worktree.path, "node_modules"))).toBe(false);
    expect(readFileSync(path.join(transfer.worktree.path, "docs", "b.md"), "utf8")).toContain("b");
    expect(git(repo, "status", "--porcelain")).toBe(callerBefore);
    expect(git(repo, "config", "--get", "branch.codex/implement-1.typiocodex").trim()).toBe("true");
  });

  it("un report qui échoue défait le worktree et la branche, en Codex indisponible", () => {
    const repo = makeRepo();
    const commit = git(repo, "rev-parse", "HEAD").trim();
    const work = prepareWorkdir(repo, commit, tempDir());
    const root = tempDir();
    const changes = { added: ["../evasion.txt"], modified: [], deleted: [], ignored: [] };
    expect(() =>
      transferToWorktree({ root: repo, branch: "codex/implement-1", startCommit: commit, srcDir: work.src, changes, worktreesRoot: root }),
    ).toThrow(UnavailableError);
    expect(existsSync(path.join(root, "codex-implement-1"))).toBe(false);
    expect(git(repo, "branch", "--list", "codex/*").trim()).toBe("");
    expect(existsSync(work.src)).toBe(true);
  });
});
