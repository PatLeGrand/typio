import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseCli } from "./cli";
import { TamperedWorkError, UnavailableError, UsageError } from "./errors";
import { formatSandboxChecks, type CheckResult } from "./verify";
import { findHiddenFiles, runVerify } from "./verifyCommand";
import { createWorktree, openOwnedWorktree } from "./worktree";

const temps: string[] = [];

function tempDir(): string {
  const dir = realpathSync.native(mkdtempSync(path.join(os.tmpdir(), "typio-codex-verify-")));
  temps.push(dir);
  return dir;
}

function git(cwd: string, ...args: string[]): string {
  const result = spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...args], { cwd, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} : ${result.stderr}`);
  return result.stdout;
}

function makeRepo(): string {
  const dir = tempDir();
  git(dir, "init", "-q", "-b", "main");
  writeFileSync(path.join(dir, "a.txt"), "a\n");
  git(dir, "add", ".");
  git(dir, "commit", "-q", "-m", "init");
  return dir;
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
});

describe("parseCli : verify", () => {
  it("lit la branche et les vérifications, toutes par défaut", () => {
    expect(parseCli(["verify", "codex/implement-1"])).toEqual({ kind: "verify", branch: "codex/implement-1", checks: ["lint", "test", "build"] });
    expect(parseCli(["verify", "codex/implement-1", "--checks", "lint,build"])).toMatchObject({ checks: ["lint", "build"] });
  });

  it.each([
    [["verify"]],
    [["verify", "main"]],
    [["verify", "codex/a", "codex/b"]],
    [["verify", "codex/a", "--checks", "none"]],
    [["verify", "codex/a", "--checks", "lint;rm"]],
    [["verify", "codex/a", "--level", "1"]],
    [["verify", "codex/a", "--keep"]],
  ])("refuse %j", (argv) => {
    expect(() => parseCli(argv)).toThrow(UsageError);
  });
});

describe("openOwnedWorktree : garde-fous de verify", () => {
  it("retrouve le chemin d'un worktree du wrapper", () => {
    const repo = makeRepo();
    const root = tempDir();
    const worktree = createWorktree(repo, "codex/implement-1", "HEAD", root);
    expect(path.resolve(openOwnedWorktree(repo, "codex/implement-1", root))).toBe(path.resolve(worktree.path));
  });

  it("refuse main, une branche inexistante et une branche codex/* qui n'est pas du wrapper", () => {
    const repo = makeRepo();
    const root = tempDir();
    git(repo, "branch", "codex/venue-d-ailleurs");
    expect(() => openOwnedWorktree(repo, "main", root)).toThrow(UsageError);
    expect(() => openOwnedWorktree(repo, "codex/inexistante", root)).toThrow(UsageError);
    expect(() => openOwnedWorktree(repo, "codex/venue-d-ailleurs", root)).toThrow(/pas été créée par ce wrapper/);
  });

  it("refuse un worktree dont le chemin réel n'est pas sous la racine", () => {
    const repo = makeRepo();
    const root = tempDir();
    const worktree = createWorktree(repo, "codex/implement-1", "HEAD", root);
    git(repo, "worktree", "move", worktree.path, path.join(tempDir(), "ailleurs"));
    expect(() => openOwnedWorktree(repo, "codex/implement-1", root)).toThrow(UsageError);
  });

  it("refuse une branche dont le worktree a disparu", () => {
    const repo = makeRepo();
    const root = tempDir();
    createWorktree(repo, "codex/implement-1", "HEAD", root);
    git(repo, "worktree", "remove", "--force", path.join(root, "codex-implement-1"));
    expect(() => openOwnedWorktree(repo, "codex/implement-1", root)).toThrow(/plus de worktree/);
  });
});

describe("runVerify : réinstalle les dépendances avant les vérifications", () => {
  function setup() {
    const repo = makeRepo();
    const root = tempDir();
    const worktree = createWorktree(repo, "codex/implement-1", "HEAD", root);
    mkdirSync(path.join(worktree.path, "node_modules", "paquet"), { recursive: true });
    writeFileSync(path.join(worktree.path, "node_modules", "paquet", "index.js"), "// piégé\n");
    mkdirSync(path.join(worktree.path, ".next"));
    writeFileSync(path.join(worktree.path, ".next", "cache"), "x");
    return { repo, root, worktree };
  }

  it("supprime node_modules/ et .next/, installe, puis lance les vérifications dans cet ordre", () => {
    const { repo, root, worktree } = setup();
    vi.spyOn(console, "log").mockImplementation(() => {});
    const events: string[] = [];
    const code = runVerify(
      repo,
      { kind: "verify", branch: "codex/implement-1", checks: ["lint", "test"] },
      {
        worktreesRoot: root,
        install: (cwd) => {
          events.push(`install@${path.resolve(cwd) === path.resolve(worktree.path)}`);
          // À ce stade, rien de ce que Codex aurait pu laisser n'existe plus.
          events.push(`node_modules:${existsSync(path.join(cwd, "node_modules"))}`);
          events.push(`.next:${existsSync(path.join(cwd, ".next"))}`);
        },
        execute: (name, cwd) => {
          events.push(`${name}@${path.resolve(cwd) === path.resolve(worktree.path)}`);
          return { exitCode: 0, output: "" };
        },
      },
    );
    expect(code).toBe(0);
    expect(events).toEqual(["install@true", "node_modules:false", ".next:false", "lint@true", "test@true"]);
  });

  it("l'installation échoue : code 2 (UnavailableError) et aucune vérification", () => {
    const { repo, root } = setup();
    vi.spyOn(console, "log").mockImplementation(() => {});
    const execute = vi.fn(() => ({ exitCode: 0, output: "" }));
    expect(() =>
      runVerify(
        repo,
        { kind: "verify", branch: "codex/implement-1", checks: ["lint"] },
        {
          worktreesRoot: root,
          install: () => {
            throw new UnavailableError("bun install a échoué");
          },
          execute,
        },
      ),
    ).toThrow(UnavailableError);
    expect(execute).not.toHaveBeenCalled();
  });

  it("une branche qui n'est pas du wrapper est refusée avant toute suppression ou installation", () => {
    const repo = makeRepo();
    git(repo, "branch", "codex/venue-d-ailleurs");
    const install = vi.fn();
    expect(() => runVerify(repo, { kind: "verify", branch: "codex/venue-d-ailleurs", checks: ["lint"] }, { worktreesRoot: tempDir(), install })).toThrow(UsageError);
    expect(install).not.toHaveBeenCalled();
  });

  it("le rapport donne le code de sortie réel de chaque vérification", () => {
    const { repo, root } = setup();
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    runVerify(
      repo,
      { kind: "verify", branch: "codex/implement-1", checks: ["lint", "build"] },
      { worktreesRoot: root, install: () => {}, execute: (name) => ({ exitCode: name === "build" ? 3 : 0, output: "boum" }) },
    );
    const text = String(log.mock.calls[0]?.[0]);
    expect(text).toContain("- bun run lint : code 0");
    expect(text).toContain("- bun run build : code 3");
    expect(text).toContain("VERIFICATIONS : ECHEC (build)");
  });
});

describe("runVerify : fichiers cachés par un .gitignore de Codex", () => {
  /** Un worktree dont le dernier commit (de Codex, relu) ajoute un `.gitignore` qui cache `secret/`. */
  function setupHidden() {
    const repo = makeRepo();
    const root = tempDir();
    const worktree = createWorktree(repo, "codex/implement-1", "HEAD", root);
    writeFileSync(path.join(worktree.path, ".gitignore"), "secret/\nnode_modules\n.next\n*.tsbuildinfo\nnext-env.d.ts\n");
    mkdirSync(path.join(worktree.path, "secret"));
    writeFileSync(path.join(worktree.path, "secret", "script.js"), "// jamais relu\n");
    return { repo, root, worktree };
  }

  it("F-1 : ALERTE (code 2) sans rien exécuter, ni supprimer, ni installer", () => {
    const { repo, root, worktree } = setupHidden();
    mkdirSync(path.join(worktree.path, "node_modules"));
    const install = vi.fn();
    const execute = vi.fn(() => ({ exitCode: 0, output: "" }));
    const run = () => runVerify(repo, { kind: "verify", branch: "codex/implement-1", checks: ["lint"] }, { worktreesRoot: root, install, execute });
    expect(run).toThrow(TamperedWorkError);
    expect(run).toThrow(/^ALERTE.*secret\//);
    expect(install).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
    expect(existsSync(path.join(worktree.path, "node_modules"))).toBe(true);
    expect(existsSync(path.join(worktree.path, "secret", "script.js"))).toBe(true);
  });

  it("findHiddenFiles : ni node_modules/ ni .next/ à la racine, ni les fichiers générés par les vérifications", () => {
    const { worktree } = setupHidden();
    rmSync(path.join(worktree.path, "secret"), { recursive: true });
    for (const dir of ["node_modules/p", ".next/cache"]) {
      mkdirSync(path.join(worktree.path, dir), { recursive: true });
      writeFileSync(path.join(worktree.path, dir, "x.js"), "x\n");
    }
    writeFileSync(path.join(worktree.path, "tsconfig.tsbuildinfo"), "{}");
    writeFileSync(path.join(worktree.path, "next-env.d.ts"), "// next\n");
    expect(findHiddenFiles(worktree.path)).toEqual([]);
  });

  it("findHiddenFiles : un node_modules/ ou .next/ hors de la racine, ou un fichier ignoré isolé, est signalé", () => {
    const { worktree } = setupHidden();
    mkdirSync(path.join(worktree.path, "sous", "node_modules"), { recursive: true });
    writeFileSync(path.join(worktree.path, "sous", "node_modules", "x.js"), "x\n");
    const hidden = findHiddenFiles(worktree.path);
    expect(hidden).toContain("secret/");
    expect(hidden.some((entry) => entry.startsWith("sous/"))).toBe(true);
  });
});

describe("formatSandboxChecks", () => {
  const lint = (exitCode: number | null): CheckResult => ({ name: "lint", exitCode, seconds: 7, output: "3 erreurs" });

  it("sans branche (Codex n'a rien changé), pas de rappel de verify", () => {
    const text = formatSandboxChecks([lint(0)], null);
    expect(text).toContain("VERIFICATIONS (bac à sable) : lint OK");
    expect(text).not.toContain("A LANCER APRÈS RELECTURE");
  });

  it("lint réussi : ligne du bac à sable et rappel de verify", () => {
    const text = formatSandboxChecks([lint(0)], "codex/implement-1");
    expect(text).toContain("VERIFICATIONS (bac à sable) : lint OK");
    expect(text).toContain("- bun run lint : code 0, 7 s");
    expect(text.trimEnd().split("\n").at(-1)).toBe("A LANCER APRÈS RELECTURE : bun scripts/codex/run.ts verify codex/implement-1");
  });

  it("lint en échec : ECHEC, code réel et sortie", () => {
    const text = formatSandboxChecks([lint(1)], "codex/implement-1");
    expect(text).toContain("VERIFICATIONS (bac à sable) : lint ECHEC");
    expect(text).toContain("code 1");
    expect(text).toContain("3 erreurs");
  });

  it("un lint sans code de sortie compte comme un échec", () => {
    expect(formatSandboxChecks([lint(null)], "codex/a")).toContain("lint ECHEC");
  });

  it("--checks none : aucune vérification, mais le rappel reste", () => {
    const text = formatSandboxChecks([], "codex/a");
    expect(text).toContain("AUCUNE");
    expect(text).toContain("A LANCER APRÈS RELECTURE");
  });
});
