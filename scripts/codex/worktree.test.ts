import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { UsageError } from "./errors";
import { GIT_HARDENING } from "./snapshot";
import {
  changedLines,
  cleanBranch,
  createWorktree,
  defaultBranchName,
  defaultWorktreesRoot,
  diffStat,
  preflightWorktree,
  statusLines,
  validateBranchName,
  worktreePath,
} from "./worktree";

describe("defaultBranchName", () => {
  it("codex/<tâche>-AAAAMMJJ-HHMMSS en heure locale", () => {
    expect(defaultBranchName("implement", new Date(2026, 9, 8, 22, 5, 9))).toBe("codex/implement-20261008-220509");
    expect(defaultBranchName("qa", new Date(2026, 0, 2, 3, 4, 5))).toBe("codex/qa-20260102-030405");
  });
});

describe("worktreePath", () => {
  it("place le worktree sous le dossier personnel, hors du dépôt, sans doubler le préfixe codex", () => {
    expect(defaultWorktreesRoot()).toBe(path.join(os.homedir(), ".typio-codex", "worktrees"));
    expect(worktreePath("codex/implement-20261008-220509")).toBe(
      path.join(os.homedir(), ".typio-codex", "worktrees", "codex-implement-20261008-220509"),
    );
  });

  it("accepte une autre racine", () => {
    const root = path.join("C:", "racine");
    expect(worktreePath("codex/implement-1", root)).toBe(path.join(root, "codex-implement-1"));
  });

  it("aplatit les sous-dossiers de branche et les caractères douteux", () => {
    expect(path.basename(worktreePath("codex/a/b c"))).toBe("codex-a-b-c");
  });
});

describe("validateBranchName", () => {
  it("accepte une branche codex/*", () => {
    expect(() => validateBranchName("codex/implement-1")).not.toThrow();
    expect(() => validateBranchName("codex/a/b.c_d")).not.toThrow();
  });

  it.each(["main", "develop", "feat/codex/x", "codex/", "codex/../x", "codex/a b", "codex/x.lock", "codex/x/"])("refuse %s", (branch) => {
    expect(() => validateBranchName(branch)).toThrow(UsageError);
  });
});

describe("changedLines", () => {
  it("renvoie ce qui apparaît ou disparaît entre deux états", () => {
    expect(changedLines([" M a.ts", "?? b.ts"], [" M a.ts", "?? c.ts"])).toEqual(["?? b.ts", "?? c.ts"]);
    expect(changedLines(["?? a"], ["?? a"])).toEqual([]);
    expect(changedLines([], [])).toEqual([]);
  });
});

describe("worktrees réels", () => {
  const temps: string[] = [];
  afterEach(() => {
    for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
  });

  function git(cwd: string, ...args: string[]): string {
    const result = spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...args], { cwd, encoding: "utf8" });
    if (result.status !== 0) throw new Error(`git ${args.join(" ")} : ${result.stderr}`);
    return result.stdout;
  }

  function makeRepo(): string {
    const dir = realpathSync.native(mkdtempSync(path.join(os.tmpdir(), "typio-codex-wt-")));
    temps.push(dir);
    git(dir, "init", "-q", "-b", "main");
    writeFileSync(path.join(dir, "a.txt"), "a\n");
    git(dir, "add", ".");
    git(dir, "commit", "-q", "-m", "init");
    return dir;
  }

  /** Racine de worktrees jetable : les tests ne touchent jamais au vrai dossier ~/.typio-codex. */
  function makeRoot(): string {
    const dir = realpathSync.native(mkdtempSync(path.join(os.tmpdir(), "typio-codex-wtroot-")));
    temps.push(dir);
    return dir;
  }

  it("crée le worktree hors du dépôt, sur une branche marquée, sans toucher au dossier appelant", () => {
    const repo = makeRepo();
    const before = statusLines(repo);
    const root = makeRoot();
    const worktree = createWorktree(repo, "codex/implement-1", "HEAD", root);
    expect(worktree.path).toBe(path.join(root, "codex-implement-1"));
    expect(worktree.path.startsWith(repo)).toBe(false);
    expect(existsSync(path.join(worktree.path, "a.txt"))).toBe(true);
    expect(git(worktree.path, "rev-parse", "--abbrev-ref", "HEAD").trim()).toBe("codex/implement-1");
    expect(statusLines(repo)).toEqual(before);
    expect(worktree.startCommit).toBe(git(repo, "rev-parse", "HEAD").trim());
    expect(git(repo, "config", "--get", "branch.codex/implement-1.typiocodex").trim()).toBe("true");
    expect(statusLines(worktree.path)).toEqual([]);
    expect(statusLines(repo)).toEqual(before);
  });

  it("diffStat : les fichiers suivis modifiés, sans toucher à l'index (pas de git add -N)", () => {
    const repo = makeRepo();
    const worktree = createWorktree(repo, "codex/implement-1", "HEAD", makeRoot());
    writeFileSync(path.join(worktree.path, "nouveau.txt"), "x\n");
    writeFileSync(path.join(worktree.path, "a.txt"), "b\n");
    const stat = diffStat(worktree);
    expect(stat).toContain("a.txt");
    expect(stat).not.toContain("nouveau.txt");
    // L'index n'a pas bougé : le fichier nouveau reste « non suivi », pas « intent to add ».
    expect(statusLines(worktree.path)).toContain("?? nouveau.txt");
    expect(git(worktree.path, "diff", "--cached", "--name-only").trim()).toBe("");
  });

  it("refuse un dossier de worktree déjà présent", () => {
    const repo = makeRepo();
    const root = makeRoot();
    mkdirSync(path.join(root, "codex-implement-1"), { recursive: true });
    expect(() => createWorktree(repo, "codex/implement-1", "HEAD", root)).toThrow(/existe déjà/);
  });

  it("échoue si le point de départ n'existe pas", () => {
    const repo = makeRepo();
    expect(() => createWorktree(repo, "codex/implement-1", "inconnue", makeRoot())).toThrow();
    expect(git(repo, "branch", "--list", "codex/*").trim()).toBe("");
  });

  it("défait le worktree et la branche si une étape échoue après worktree add", () => {
    const repo = makeRepo();
    const root = makeRoot();
    // Un verrou sur la configuration fait échouer `git config` après `worktree add`.
    const lock = path.join(repo, ".git", "config.lock");
    writeFileSync(lock, "");
    expect(() => createWorktree(repo, "codex/implement-1", "HEAD", root)).toThrow();
    rmSync(lock, { force: true });
    expect(git(repo, "branch", "--list", "codex/*").trim()).toBe("");
    expect(existsSync(path.join(root, "codex-implement-1"))).toBe(false);
    expect(git(repo, "worktree", "list", "--porcelain")).not.toContain("codex-implement-1");
  });

  it("clean supprime le worktree et la branche créés par le wrapper", () => {
    const repo = makeRepo();
    const root = makeRoot();
    const worktree = createWorktree(repo, "codex/implement-1", "HEAD", root);
    writeFileSync(path.join(worktree.path, "nouveau.txt"), "x\n");
    const removed = cleanBranch(repo, "codex/implement-1", root);
    expect(removed).toHaveLength(2);
    expect(existsSync(worktree.path)).toBe(false);
    expect(git(repo, "branch", "--list", "codex/*").trim()).toBe("");
    expect(git(repo, "worktree", "list", "--porcelain")).not.toContain("codex-implement-1");
  });

  it("clean retrouve le worktree par git worktree list, pas par le chemin", () => {
    const repo = makeRepo();
    const root = makeRoot();
    const worktree = createWorktree(repo, "codex/implement-1", "HEAD", root);
    // Le dossier est déplacé (toujours sous la racine) : seul le registre de git sait où il est.
    const moved = path.join(root, "ailleurs");
    git(repo, "worktree", "move", worktree.path, moved);
    cleanBranch(repo, "codex/implement-1", root);
    expect(existsSync(moved)).toBe(false);
    expect(git(repo, "branch", "--list", "codex/*").trim()).toBe("");
  });

  it("clean refuse un worktree dont le chemin réel n'est pas sous la racine, sans rien supprimer", () => {
    const repo = makeRepo();
    const root = makeRoot();
    const worktree = createWorktree(repo, "codex/implement-1", "HEAD", root);
    const elsewhere = path.join(makeRoot(), "ailleurs");
    git(repo, "worktree", "move", worktree.path, elsewhere);
    expect(() => cleanBranch(repo, "codex/implement-1", root)).toThrow(UsageError);
    expect(existsSync(elsewhere)).toBe(true);
    expect(git(repo, "branch", "--list", "codex/*")).toContain("codex/implement-1");
  });

  it("clean refuse un worktree atteint par une jonction qui sort de la racine", () => {
    const repo = makeRepo();
    const root = makeRoot();
    const outside = path.join(makeRoot(), "reel");
    const worktree = createWorktree(repo, "codex/implement-1", "HEAD", makeRoot());
    git(repo, "worktree", "move", worktree.path, outside);
    // Le registre pointe sous la racine, mais ce chemin est une jonction vers un dossier extérieur.
    const linked = path.join(root, "codex-lien");
    symlinkSync(outside, linked, "junction");
    git(repo, "worktree", "repair", linked);
    expect(() => cleanBranch(repo, "codex/implement-1", root)).toThrow(UsageError);
    expect(existsSync(outside)).toBe(true);
  });

  it("clean refuse une branche codex/* qui n'a pas été créée par le wrapper", () => {
    const repo = makeRepo();
    git(repo, "branch", "codex/venue-d-ailleurs");
    expect(() => cleanBranch(repo, "codex/venue-d-ailleurs", makeRoot())).toThrow(UsageError);
    expect(git(repo, "branch", "--list", "codex/*")).toContain("codex/venue-d-ailleurs");
  });

  it("clean refuse main, une branche hors codex/* et une branche inexistante", () => {
    const repo = makeRepo();
    expect(() => cleanBranch(repo, "main", makeRoot())).toThrow(UsageError);
    expect(() => cleanBranch(repo, "codex/inexistante", makeRoot())).toThrow(UsageError);
    expect(git(repo, "branch", "--list", "main")).toContain("main");
  });

  it("git durci : une commande fsmonitor ou un hook de la configuration n'est pas exécuté", () => {
    const repo = makeRepo();
    const proof = path.join(makeRoot(), "execute.txt").replaceAll("\\", "/");
    git(repo, "config", "core.fsmonitor", `touch '${proof}'`);
    // Témoin : git ordinaire exécute bien la commande, sinon ce test ne prouverait rien.
    spawnSync("git", ["status", "--porcelain"], { cwd: repo });
    expect(existsSync(proof)).toBe(true);
    rmSync(proof);
    statusLines(repo);
    expect(existsSync(proof)).toBe(false);
  });

  it("git durci : sous-modules ignorés dans les diffs et jamais parcourus", () => {
    expect(GIT_HARDENING.join(" ")).toContain("diff.ignoreSubmodules=all");
    expect(GIT_HARDENING.join(" ")).toContain("submodule.recurse=false");
    expect(GIT_HARDENING.join(" ")).toContain("core.fsmonitor=false");
    expect(GIT_HARDENING.join(" ")).toContain("core.hooksPath=");
  });

  describe("preflightWorktree", () => {
    it("renvoie le commit de départ résolu", () => {
      const repo = makeRepo();
      expect(preflightWorktree(repo, "codex/ok", "HEAD")).toBe(git(repo, "rev-parse", "HEAD").trim());
    });

    it("refuse une --from inconnue par une erreur d'usage", () => {
      const repo = makeRepo();
      expect(() => preflightWorktree(repo, "codex/ok", "n-existe-pas")).toThrow(UsageError);
      expect(() => preflightWorktree(repo, "codex/ok", "n-existe-pas")).toThrow(/--from n-existe-pas/);
    });

    it("refuse une --from qui commence par un tiret", () => {
      const repo = makeRepo();
      expect(() => preflightWorktree(repo, "codex/ok", "--all")).toThrow(UsageError);
    });

    it("refuse une branche déjà existante", () => {
      const repo = makeRepo();
      git(repo, "branch", "codex/deja");
      expect(() => preflightWorktree(repo, "codex/deja", "HEAD")).toThrow(/existe déjà/);
    });

    it("refuse un nom de branche que git n'accepte pas", () => {
      const repo = makeRepo();
      expect(() => preflightWorktree(repo, "codex/a.", "HEAD")).toThrow(UsageError);
      expect(() => preflightWorktree(repo, "codex/a@{b", "HEAD")).toThrow(UsageError);
    });
  });
});
