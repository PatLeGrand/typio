import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { WriteCommand } from "./cli";
import type { CodexRun, RunOptions } from "./codex";
import type { IgnoreCheck } from "./collect";
import { TamperedWorkError, UnavailableError } from "./errors";
import { runWrite, type WriteDeps } from "./write";

// Ces tests montent de vrais dépôts git : sous la charge de la suite complète, ils dépassent les 5 s par défaut.
vi.setConfig({ testTimeout: 30_000 });

/**
 * `runWrite` de bout en bout avec un faux Codex : un vrai dépôt git temporaire, de vraies copies de travail
 * et de vrais worktrees, mais ni Codex, ni quota, ni `bun install`, ni lint réels. Le faux Codex agit sur le
 * dossier `-C` qu'on lui donne et écrit le fichier `-o`, comme le vrai.
 */

const temps: string[] = [];

function tempDir(): string {
  const dir = realpathSync.native(mkdtempSync(path.join(os.tmpdir(), "typio-codex-runwrite-")));
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

const ENV_SECRET = "valeur-secrete-synthetique-0001";

function setup(overrides: Partial<WriteCommand> = {}, depsOverrides: WriteDeps = {}) {
  const repo = tempDir();
  git(repo, "init", "-q", "-b", "main");
  writeFileSync(path.join(repo, ".gitignore"), "dist/\n.env*\n");
  writeFileSync(path.join(repo, "a.txt"), "a\n");
  writeFileSync(path.join(repo, "package.json"), '{ "name": "x" }\n');
  git(repo, "add", ".");
  git(repo, "commit", "-q", "-m", "init");
  const briefPath = path.join(tempDir(), "brief.md");
  writeFileSync(briefPath, "# Brief\n\nCrée docs/nouveau.md.\n");
  const workParent = tempDir();
  const worktreesRoot = tempDir();
  const stateParent = tempDir();
  const lint = vi.fn((): ReturnType<NonNullable<WriteDeps["runLint"]>> => [{ name: "lint", exitCode: 0, seconds: 1, output: "" }]);
  const ignoreCheck = vi.fn((): IgnoreCheck => () => new Set<string>());
  const copyDependencies = vi.fn();
  const deps: WriteDeps = {
    cwd: repo,
    resolveBinary: () => "codex-faux",
    ensureQuota: async () => {},
    verifyWriteCanary: async () => null,
    verifySandboxCanary: async () => null,
    copyDependencies,
    runLint: lint,
    execute: () => ({ exitCode: 0, output: "" }),
    ignoreCheck,
    secretSources: () => [],
    workParent,
    worktreesRoot,
    stateParent,
    ...depsOverrides,
  };
  const command: WriteCommand = {
    kind: "write",
    task: "implement",
    level: 1,
    briefPath,
    from: "HEAD",
    branch: "codex/test-1",
    checks: ["lint"],
    quotaThreshold: 90,
    keep: false,
    ...overrides,
  };
  const out = vi.spyOn(console, "log").mockImplementation(() => {});
  const err = vi.spyOn(console, "error").mockImplementation(() => {});
  const stdout = (): string => out.mock.calls.map((call) => String(call[0])).join("\n");
  const stderr = (): string => err.mock.calls.map((call) => String(call[0])).join("\n");
  return { repo, command, deps, workParent, worktreesRoot, stateParent, lint, ignoreCheck, copyDependencies, stdout, stderr };
}

/** Un Codex factice : `act` reçoit le dossier de travail (`-C`), le message final est écrit dans `-o`. */
function fakeCodex(act: (src: string) => void, { exitCode = 0, message = "Fait." }: { exitCode?: number; message?: string } = {}): WriteDeps["runCodex"] {
  return async ({ args }: RunOptions): Promise<CodexRun> => {
    const src = String(args[args.indexOf("-C") + 1]);
    const lastMessage = String(args[args.indexOf("-o") + 1]);
    act(src);
    if (message !== "") writeFileSync(lastMessage, message);
    return { stdout: "", stderr: exitCode === 0 ? "" : "boum", exitCode, timedOut: false, missing: false };
  };
}

const put = (src: string, rel: string, content: string): void => {
  mkdirSync(path.dirname(path.join(src, rel)), { recursive: true });
  writeFileSync(path.join(src, rel), content);
};

const entries = (dir: string): string[] => readdirSync(dir);

describe("runWrite : succès", () => {
  it("copie le modèle dans src pour les niveaux 2 et 4 et pour qa, mais pas pour le niveau 1", async () => {
    for (const overrides of [{ level: 1 }, { level: 2 }, { level: 4 }, { task: "qa", level: undefined }] as Partial<WriteCommand>[]) {
      const t = setup(overrides);
      t.deps.runCodex = fakeCodex(() => {});
      await runWrite(t.command, t.deps);
      expect(t.copyDependencies.mock.calls.map((call) => path.basename(String(call[0])))).toEqual(
        overrides.level === 1 ? [] : ["src"],
      );
    }
  });

  it("crée le worktree avec les seuls fichiers changés, supprime work/ et ne touche pas au dossier appelant", async () => {
    const t = setup();
    const callerBefore = git(t.repo, "status", "--porcelain");
    t.deps.runCodex = fakeCodex((src) => {
      put(src, "docs/nouveau.md", "nouveau\n");
      put(src, "dist/bundle.js", "ignoré\n");
    });
    t.ignoreCheck.mockReturnValue((paths) => new Set(paths.filter((rel) => rel.startsWith("dist/"))));

    expect(await runWrite(t.command, t.deps)).toBe(0);

    expect(entries(t.workParent)).toEqual([]);
    const worktree = path.join(t.worktreesRoot, "codex-test-1");
    expect(readFileSync(path.join(worktree, "docs", "nouveau.md"), "utf8")).toBe("nouveau\n");
    expect(existsSync(path.join(worktree, "dist"))).toBe(false);
    expect(git(t.repo, "branch", "--list", "codex/test-1")).toContain("codex/test-1");
    expect(t.stdout()).toContain("docs/nouveau.md");
    expect(t.stdout()).toContain("dist/bundle.js");
    expect(t.stdout()).toContain("VERIFICATIONS (bac à sable) : lint OK");
    expect(t.stdout()).not.toContain("A RELIRE EN PRIORITÉ");
    expect(git(t.repo, "status", "--porcelain")).toBe(callerBefore);
  });

  it("la référence base/ n'existe pas pendant que Codex travaille, et le balayage précède le lint", async () => {
    const t = setup();
    const order: string[] = [];
    t.deps.runCodex = fakeCodex((src) => {
      order.push(`base:${existsSync(path.join(path.dirname(src), "base"))}`);
      put(src, "docs/nouveau.md", "n\n");
    });
    t.lint.mockImplementation(() => {
      order.push("lint");
      return [{ name: "lint", exitCode: 0, seconds: 1, output: "" }];
    });
    await runWrite(t.command, t.deps);
    expect(order).toEqual(["base:false", "lint"]);
  });

  it("un diff qui touche package.json ou .gitignore ouvre le rapport sur « A RELIRE EN PRIORITÉ »", async () => {
    const t = setup();
    t.deps.runCodex = fakeCodex((src) => {
      put(src, "package.json", '{ "name": "y" }\n');
      put(src, "docs/.gitignore", "*\n");
    });
    await runWrite(t.command, t.deps);
    const report = t.stdout();
    expect(report).toContain("A RELIRE EN PRIORITÉ");
    expect(report.indexOf("A RELIRE EN PRIORITÉ")).toBeLessThan(report.indexOf("Fait."));
    expect(report).toContain("package.json (modifié)");
    expect(report).toContain("docs/.gitignore (ajouté)");
  });

  it("Codex ne change rien : ni worktree ni branche, work/ supprimé", async () => {
    const t = setup();
    t.deps.runCodex = fakeCodex(() => {});
    expect(await runWrite(t.command, t.deps)).toBe(0);
    expect(entries(t.workParent)).toEqual([]);
    expect(entries(t.worktreesRoot)).toEqual([]);
    expect(git(t.repo, "branch", "--list", "codex/*").trim()).toBe("");
    expect(t.stdout()).toContain("Aucun changement");
  });

  it("--keep : work/ est gardé même après un succès", async () => {
    const t = setup({ keep: true });
    t.deps.runCodex = fakeCodex((src) => put(src, "docs/nouveau.md", "n\n"));
    await runWrite(t.command, t.deps);
    expect(entries(t.workParent)).toHaveLength(1);
    expect(t.stderr()).toContain("clean --work");
  });
});

describe("runWrite : Codex échoue", () => {
  it("sans changement : work/ supprimé, code 2", async () => {
    const t = setup();
    t.deps.runCodex = fakeCodex(() => {}, { exitCode: 1, message: "" });
    await expect(runWrite(t.command, t.deps)).rejects.toThrow(UnavailableError);
    expect(entries(t.workParent)).toEqual([]);
    expect(entries(t.worktreesRoot)).toEqual([]);
    expect(git(t.repo, "branch", "--list", "codex/*").trim()).toBe("");
  });

  it("avec changements : work/ gardé, clean --work affiché, l'échec reste un UnavailableError", async () => {
    const t = setup();
    t.deps.runCodex = fakeCodex((src) => put(src, "docs/partiel.md", "partiel\n"), { exitCode: 1, message: "" });
    await expect(runWrite(t.command, t.deps)).rejects.toThrow(UnavailableError);
    const [id] = entries(t.workParent);
    expect(id).toBeDefined();
    expect(readFileSync(path.join(t.workParent, id ?? "", "src", "docs", "partiel.md"), "utf8")).toBe("partiel\n");
    expect(t.stderr()).toContain(`clean --work ${id}`);
    expect(t.stderr()).toContain("src contient des changements");
    expect(entries(t.worktreesRoot)).toEqual([]);
  });

  it("réponse vide malgré le code 0 : même règle", async () => {
    const t = setup();
    t.deps.runCodex = fakeCodex((src) => put(src, "docs/partiel.md", "partiel\n"), { message: "" });
    await expect(runWrite(t.command, t.deps)).rejects.toThrow(/réponse vide/);
    expect(entries(t.workParent)).toHaveLength(1);
  });

  it("travail piégé après un échec : l'ALERTE remplace l'échec", async () => {
    const t = setup();
    t.deps.runCodex = fakeCodex((src) => put(src, "evil/.git/config", "x\n"), { exitCode: 1, message: "" });
    await expect(runWrite(t.command, t.deps)).rejects.toThrow(TamperedWorkError);
    expect(entries(t.workParent)).toHaveLength(1);
  });

  it("binaire introuvable : rien à garder", async () => {
    const t = setup();
    t.deps.runCodex = async () => ({ stdout: "", stderr: "", exitCode: null, timedOut: false, missing: true });
    await expect(runWrite(t.command, t.deps)).rejects.toThrow(/introuvable/);
    expect(entries(t.workParent)).toEqual([]);
  });
});

describe("runWrite : erreur après la réussite de Codex", () => {
  it("erreur de collecte : work/ gardé avec la raison et clean --work, pas de worktree", async () => {
    const t = setup();
    t.deps.runCodex = fakeCodex((src) => put(src, "docs/nouveau.md", "n\n"));
    t.ignoreCheck.mockReturnValue(() => {
      throw new UnavailableError("git check-ignore : boum");
    });
    await expect(runWrite(t.command, t.deps)).rejects.toThrow(/check-ignore/);
    const [id] = entries(t.workParent);
    expect(id).toBeDefined();
    expect(t.stderr()).toContain("n'a pas été reporté (git check-ignore : boum)");
    expect(t.stderr()).toContain(`clean --work ${id}`);
    expect(entries(t.worktreesRoot)).toEqual([]);
    expect(git(t.repo, "branch", "--list", "codex/*").trim()).toBe("");
  });

  it("erreur du lint (ou signal après le lint) : work/ gardé", async () => {
    const t = setup();
    t.deps.runCodex = fakeCodex((src) => put(src, "docs/nouveau.md", "n\n"));
    t.lint.mockImplementation(() => {
      throw new UnavailableError("interrompu (SIGINT)");
    });
    await expect(runWrite(t.command, t.deps)).rejects.toThrow(/interrompu/);
    expect(entries(t.workParent)).toHaveLength(1);
  });

  it("un report qui échoue (chemin sortant du worktree) défait le worktree et garde work/", async () => {
    const t = setup();
    t.deps.runCodex = fakeCodex((src) => put(src, "docs/nouveau.md", "n\n"));
    // Une branche qui existe déjà après le pré-contrôle : createWorktree échoue.
    t.ignoreCheck.mockImplementation(() => {
      git(t.repo, "branch", "codex/test-1");
      return () => new Set<string>();
    });
    await expect(runWrite(t.command, t.deps)).rejects.toThrow();
    expect(entries(t.workParent)).toHaveLength(1);
    expect(entries(t.worktreesRoot)).toEqual([]);
  });
});

describe("runWrite : ALERTE", () => {
  it("un dépôt git imbriqué : work/ gardé, aucun git sur src, ni lint ni worktree", async () => {
    const t = setup();
    t.deps.runCodex = fakeCodex((src) => {
      put(src, "evil/.git/config", '[filter "x"]\n\tclean = calc\n');
      put(src, "evil/.gitattributes", "* filter=x\n");
    });
    await expect(runWrite(t.command, t.deps)).rejects.toThrow(TamperedWorkError);
    await expect(runWrite({ ...t.command, branch: "codex/test-2" }, t.deps)).rejects.toThrow(/^ALERTE/);
    expect(entries(t.workParent)).toHaveLength(2);
    expect(t.lint).not.toHaveBeenCalled();
    expect(entries(t.worktreesRoot)).toEqual([]);
    expect(t.stderr()).toContain("clean --work");
  });

  it("un .codex/ est refusé même avec --checks none, et avec --sortie-bac-a-sable", async () => {
    for (const overrides of [{ checks: [] }, { sandboxExitReason: "base locale", checks: [] }] satisfies Partial<WriteCommand>[]) {
      const t = setup(overrides);
      t.deps.runCodex = fakeCodex((src) => put(src, ".codex/config.toml", 'sandbox_mode = "danger-full-access"\n'));
      await expect(runWrite(t.command, t.deps)).rejects.toThrow(/^ALERTE.*\.codex/);
      expect(entries(t.workParent)).toHaveLength(1);
    }
  });

  it("une valeur secrète dans le diff : ALERTE sans la valeur, work/ gardé, rien de reporté", async () => {
    const t = setup({}, { secretSources: () => [{ label: ".env.local", values: [ENV_SECRET] }] });
    t.deps.runCodex = fakeCodex((src) => put(src, "docs/nouveau.md", `clé : ${ENV_SECRET}\n`));
    let message = "";
    await runWrite(t.command, t.deps).catch((error: unknown) => {
      expect(error).toBeInstanceOf(TamperedWorkError);
      message = (error as Error).message;
    });
    expect(message).toContain("docs/nouveau.md");
    expect(message).toContain(".env.local");
    expect(message).not.toContain(ENV_SECRET);
    expect(t.stderr()).not.toContain(ENV_SECRET);
    expect(entries(t.workParent)).toHaveLength(1);
    expect(entries(t.worktreesRoot)).toEqual([]);
  });
});

describe("runWrite : valeurs déjà publiques", () => {
  const PUBLIC_URL = "http://localhost:3000/public";

  it("un fichier suivi qui contenait déjà la valeur peut être modifié sans ALERTE", async () => {
    const t = setup({}, { secretSources: () => [{ label: ".env.local", values: [PUBLIC_URL, ENV_SECRET] }] });
    writeFileSync(path.join(t.repo, "README.md"), `Origine : ${PUBLIC_URL}\n`);
    git(t.repo, "add", ".");
    git(t.repo, "commit", "-q", "-m", "readme");
    t.deps.runCodex = fakeCodex((src) => {
      put(src, "README.md", `Origine : ${PUBLIC_URL}\nUne ligne de plus.\n`);
      put(src, "docs/nouveau.md", `Voir ${PUBLIC_URL}\n`);
    });
    expect(await runWrite(t.command, t.deps)).toBe(0);
    expect(entries(t.workParent)).toEqual([]);
  });

  it("une valeur absente de base/ reste une ALERTE, même à côté d'une valeur publique", async () => {
    const t = setup({}, { secretSources: () => [{ label: ".env.local", values: [PUBLIC_URL, ENV_SECRET] }] });
    writeFileSync(path.join(t.repo, "README.md"), `Origine : ${PUBLIC_URL}\n`);
    git(t.repo, "add", ".");
    git(t.repo, "commit", "-q", "-m", "readme");
    t.deps.runCodex = fakeCodex((src) => put(src, "README.md", `Origine : ${PUBLIC_URL}\nclé : ${ENV_SECRET}\n`));
    await expect(runWrite(t.command, t.deps)).rejects.toThrow(TamperedWorkError);
    expect(entries(t.workParent)).toHaveLength(1);
  });
});

describe("runWrite : --sortie-bac-a-sable", () => {
  it("installe dans le worktree neuf, y lance les vérifications, supprime les caches des canaris et le dit", async () => {
    const t = setup({ sandboxExitReason: "base locale", checks: ["lint", "test"] });
    writeFileSync(path.join(t.stateParent, "canary-write.json"), "{}");
    writeFileSync(path.join(t.stateParent, "canary-sandbox.json"), "{}");
    writeFileSync(path.join(t.stateParent, "autre.json"), "{}");
    t.deps.runCodex = fakeCodex((src) => put(src, "docs/nouveau.md", "n\n"));
    const executed: string[] = [];
    t.deps.execute = (name, cwd) => {
      executed.push(`${name}@${path.basename(cwd)}`);
      return { exitCode: 0, output: "" };
    };
    expect(await runWrite(t.command, t.deps)).toBe(0);
    expect(t.lint).not.toHaveBeenCalled();
    expect(t.copyDependencies.mock.calls.map((call) => path.basename(String(call[0])))).toEqual(["codex-test-1"]);
    expect(executed).toEqual(["lint@codex-test-1", "test@codex-test-1"]);
    expect(entries(t.stateParent).filter((name) => name.endsWith(".json"))).toEqual(["autre.json"]);
    expect(t.stdout()).toContain("canary-*.json");
    expect(entries(t.workParent)).toEqual([]);
  });

  it("les caches sont supprimés même si Codex échoue", async () => {
    const t = setup({ sandboxExitReason: "base locale" });
    writeFileSync(path.join(t.stateParent, "canary-write.json"), "{}");
    t.deps.runCodex = fakeCodex(() => {}, { exitCode: 1, message: "" });
    await expect(runWrite(t.command, t.deps)).rejects.toThrow(UnavailableError);
    expect(entries(t.stateParent).filter((name) => name.startsWith("canary-"))).toEqual([]);
  });

  it("dans le bac à sable, les caches des canaris ne sont pas touchés", async () => {
    const t = setup();
    writeFileSync(path.join(t.stateParent, "canary-write.json"), "{}");
    t.deps.runCodex = fakeCodex((src) => put(src, "docs/nouveau.md", "n\n"));
    await runWrite(t.command, t.deps);
    expect(entries(t.stateParent)).toContain("canary-write.json");
    expect(t.stdout()).not.toContain("canary-*.json");
  });
});
