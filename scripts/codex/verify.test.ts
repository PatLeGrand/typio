import { existsSync, mkdirSync, mkdtempSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { checkEnv } from "./codex";
import { UsageError } from "./errors";
import { formatChecks, parseChecks, runChecks, runSandboxedChecks, type CheckResult, type SpawnCheck } from "./verify";

const ok = (name: string): CheckResult => ({ name, exitCode: 0, seconds: 3, output: "tout va bien" });

describe("formatChecks", () => {
  it("toutes réussies : codes de sortie, durées et VERIFICATIONS : OK", () => {
    const text = formatChecks([ok("lint"), ok("test"), ok("build")]);
    expect(text).toContain("- bun run lint : code 0, 3 s");
    expect(text).toContain("- bun run build : code 0, 3 s");
    expect(text.trimEnd().split("\n").at(-1)).toBe("VERIFICATIONS : OK");
    expect(text).not.toContain("tout va bien");
  });

  it("un code de sortie non nul apparaît tel quel et donne VERIFICATIONS : ECHEC", () => {
    const text = formatChecks([ok("lint"), { name: "test", exitCode: 7, seconds: 12, output: "1 test en échec" }, ok("build")]);
    expect(text).toContain("- bun run test : code 7, 12 s");
    expect(text).toContain("1 test en échec");
    expect(text.trimEnd().split("\n").at(-1)).toBe("VERIFICATIONS : ECHEC (test)");
  });

  it("liste toutes les vérifications en échec dans l'ordre", () => {
    const text = formatChecks([
      { name: "lint", exitCode: 1, seconds: 1, output: "x" },
      ok("test"),
      { name: "build", exitCode: 2, seconds: 1, output: "y" },
    ]);
    expect(text.trimEnd().split("\n").at(-1)).toBe("VERIFICATIONS : ECHEC (lint, build)");
  });

  it("n'affiche que les 40 dernières lignes de la sortie d'un échec", () => {
    const output = Array.from({ length: 100 }, (_, index) => `ligne ${index + 1}`).join("\n");
    const text = formatChecks([{ name: "build", exitCode: 1, seconds: 1, output }]);
    expect(text).toContain("ligne 100");
    expect(text).toContain("ligne 61");
    expect(text).not.toContain("ligne 60\n");
  });

  it("un processus sans code de sortie (délai) compte comme un échec et le dit", () => {
    const text = formatChecks([{ name: "build", exitCode: null, seconds: 900, output: "", problem: "délai de 15 min dépassé" }]);
    expect(text).toContain("sans code de sortie (délai de 15 min dépassé)");
    expect(text.trimEnd().split("\n").at(-1)).toBe("VERIFICATIONS : ECHEC (build)");
  });

  it("vérifications désactivées : ni OK ni ECHEC", () => {
    const text = formatChecks([]);
    expect(text).toContain("AUCUNE");
    expect(text).not.toContain("VERIFICATIONS : OK");
    expect(text).not.toContain("ECHEC");
  });
});

describe("runChecks", () => {
  it("lance toutes les vérifications même si l'une échoue, dans l'ordre", () => {
    const launched: string[] = [];
    const results = runChecks(["lint", "test", "build"], "C:\\worktree", (name, cwd) => {
      launched.push(`${name}@${cwd}`);
      return { exitCode: name === "lint" ? 1 : 0, output: "" };
    });
    expect(launched).toEqual(["lint@C:\\worktree", "test@C:\\worktree", "build@C:\\worktree"]);
    expect(results.map(({ name, exitCode }) => [name, exitCode])).toEqual([
      ["lint", 1],
      ["test", 0],
      ["build", 0],
    ]);
  });
});

describe("parseChecks", () => {
  it("défaut : lint, test, build", () => {
    expect(parseChecks(undefined)).toEqual(["lint", "test", "build"]);
  });

  it("none désactive, une liste choisit", () => {
    expect(parseChecks("none")).toEqual([]);
    expect(parseChecks("lint")).toEqual(["lint"]);
    expect(parseChecks("lint, build")).toEqual(["lint", "build"]);
  });

  it.each(["", "lint,", "lint;calc", "a b", "../x"])("refuse %j", (value) => {
    expect(() => parseChecks(value)).toThrow(UsageError);
  });
});

describe("checkEnv : environnement des vérifications", () => {
  const source: NodeJS.ProcessEnv = {
    NODE_ENV: "development",
    Path: "C:\\Windows",
    USERPROFILE: "C:\\Users\\me",
    DATABASE_URL: "postgres://typio:pw@localhost:5433/typio",
    AUTH_SECRET: "secret",
    AUTH_GITHUB_ID: "id",
    AUTH_GITHUB_SECRET: "secret",
    SESSION_SECRET: "secret",
    OPENAI_API_KEY: "sk-secret",
  };

  it("garde l'allowlist et NODE_ENV", () => {
    const env = checkEnv(source);
    expect(env.Path).toBe("C:\\Windows");
    expect(env.USERPROFILE).toBe("C:\\Users\\me");
    expect(env.NODE_ENV).toBe("development");
  });

  it("transmet DATABASE_URL vers une base locale", () => {
    expect(checkEnv(source).DATABASE_URL).toBe(source.DATABASE_URL);
    expect(checkEnv({ ...source, DATABASE_URL: "postgres://u:p@127.0.0.1/typio" }).DATABASE_URL).toBeDefined();
    expect(checkEnv({ ...source, DATABASE_URL: "postgres://u:p@[::1]/typio" }).DATABASE_URL).toBeDefined();
  });

  it("n'envoie jamais une autre URL de base", () => {
    expect(checkEnv({ ...source, DATABASE_URL: "postgres://u:p@db.example.com/typio" }).DATABASE_URL).toBeUndefined();
    expect(checkEnv({ ...source, DATABASE_URL: "postgres://u:p@localhost/typio?host=evil.com" }).DATABASE_URL).toBeUndefined();
  });

  it("n'envoie jamais les AUTH_* ni aucune autre variable du .env.local", () => {
    const env = checkEnv(source);
    expect(env.AUTH_SECRET).toBeUndefined();
    expect(env.AUTH_GITHUB_ID).toBeUndefined();
    expect(env.AUTH_GITHUB_SECRET).toBeUndefined();
    expect(env.SESSION_SECRET).toBeUndefined();
    expect(env.OPENAI_API_KEY).toBeUndefined();
  });
});

describe("runSandboxedChecks : le lint dans codex sandbox, sur src", () => {
  const temps: string[] = [];
  afterEach(() => {
    vi.unstubAllEnvs();
    for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
  });

  function makeWork(): { base: string; src: string; homes: string } {
    const dir = realpathSync.native(mkdtempSync(path.join(os.tmpdir(), "typio-codex-lint-")));
    temps.push(dir);
    for (const name of ["base", "src", "homes"]) mkdirSync(path.join(dir, name));
    for (const name of ["base", "src"]) writeFileSync(path.join(dir, name, "a.txt"), "a\n");
    return { base: path.join(dir, "base"), src: path.join(dir, "src"), homes: path.join(dir, "homes") };
  }

  type Call = { bin: string; args: readonly string[]; cwd: string; env: NodeJS.ProcessEnv; homeExisted: boolean };

  function recorder(exitCode = 0) {
    const calls: Call[] = [];
    const spawn: SpawnCheck = (bin, args, cwd, env) => {
      calls.push({ bin, args: [...args], cwd, env, homeExisted: existsSync(String(env.CODEX_HOME)) });
      return { exitCode, output: "" };
    };
    return { calls, spawn };
  }

  it("AC-5 : lance bun run lint dans codex sandbox -P :workspace, dans src, réseau coupé", () => {
    const work = makeWork();
    const { calls, spawn } = recorder();
    const results = runSandboxedChecks("codex.exe", ["lint"], work.src, spawn, work.homes);
    expect(results.map(({ name, exitCode }) => [name, exitCode])).toEqual([["lint", 0]]);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.bin).toBe("codex.exe");
    expect(calls[0]?.cwd).toBe(work.src);
    expect(calls[0]?.args).toEqual([
      "sandbox", "-P", ":workspace", "-C", work.src,
      "-c", 'windows.sandbox="unelevated"',
      "-c", "sandbox_workspace_write.network_access=false",
      "--", process.execPath, "run", "lint",
    ]);
  });

  it("AC-5 : CODEX_HOME jetable, créé pour chaque exécution puis supprimé ; ni DATABASE_URL ni secret", () => {
    vi.stubEnv("DATABASE_URL", "postgres://u:p@localhost:5433/typio");
    vi.stubEnv("AUTH_SECRET", "secret");
    const work = makeWork();
    const { calls, spawn } = recorder();
    runSandboxedChecks("codex.exe", ["lint", "lint:autre"], work.src, spawn, work.homes);
    expect(calls).toHaveLength(2);
    const homes = calls.map((call) => String(call.env.CODEX_HOME));
    expect(new Set(homes).size).toBe(2);
    for (const [index, call] of calls.entries()) {
      expect(path.dirname(homes[index] ?? "")).toBe(work.homes);
      expect(call.homeExisted).toBe(true);
      expect(existsSync(homes[index] ?? "")).toBe(false);
      expect(call.env.DATABASE_URL).toBeUndefined();
      expect(call.env.AUTH_SECRET).toBeUndefined();
    }
    expect(readdirSync(work.homes)).toEqual([]);
  });

  it("--checks none : rien n'est lancé", () => {
    const work = makeWork();
    const { calls, spawn } = recorder();
    expect(runSandboxedChecks("codex.exe", [], work.src, spawn, work.homes)).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it("un lint en échec garde son code de sortie réel", () => {
    const work = makeWork();
    const { spawn } = recorder(1);
    expect(runSandboxedChecks("codex.exe", ["lint"], work.src, spawn, work.homes)[0]?.exitCode).toBe(1);
  });
});
