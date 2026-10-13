import { existsSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { sandboxCommandArgs, sandboxEnv, withDisposableCodexHome } from "./sandbox";

const temps: string[] = [];

function tempDir(): string {
  const dir = realpathSync.native(mkdtempSync(path.join(os.tmpdir(), "typio-codex-sandbox-")));
  temps.push(dir);
  return dir;
}

afterEach(() => {
  vi.unstubAllEnvs();
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
});

describe("sandboxCommandArgs", () => {
  it("AC-5 : profil :workspace, dossier de travail, réseau coupé, commande après --", () => {
    expect(sandboxCommandArgs("C:\\work\\run-1\\src", ["bun.exe", "run", "lint"])).toEqual([
      "sandbox", "-P", ":workspace", "-C", "C:\\work\\run-1\\src",
      "-c", 'windows.sandbox="unelevated"',
      "-c", "sandbox_workspace_write.network_access=false",
      "--", "bun.exe", "run", "lint",
    ]);
  });
});

describe("withDisposableCodexHome", () => {
  it("AC-5 : crée un CODEX_HOME vide pour l'exécution, puis le supprime", () => {
    const parent = tempDir();
    let seen = "";
    const result = withDisposableCodexHome((home) => {
      seen = home;
      expect(path.dirname(home)).toBe(parent);
      expect(existsSync(home)).toBe(true);
      return 42;
    }, parent);
    expect(result).toBe(42);
    expect(existsSync(seen)).toBe(false);
  });

  it("chaque exécution a le sien", () => {
    const parent = tempDir();
    const homes: string[] = [];
    withDisposableCodexHome((home) => homes.push(home), parent);
    withDisposableCodexHome((home) => homes.push(home), parent);
    expect(new Set(homes).size).toBe(2);
  });

  it("est supprimé même si l'exécution lève", () => {
    const parent = tempDir();
    let seen = "";
    expect(() =>
      withDisposableCodexHome((home) => {
        seen = home;
        throw new Error("boum");
      }, parent),
    ).toThrow("boum");
    expect(existsSync(seen)).toBe(false);
  });
});

describe("sandboxEnv", () => {
  it("CODEX_HOME jetable, variables du canari, jamais DATABASE_URL ni secret", () => {
    vi.stubEnv("DATABASE_URL", "postgres://u:p@localhost:5433/typio");
    vi.stubEnv("AUTH_SECRET", "secret");
    vi.stubEnv("CODEX_HOME", "C:\\utilisateur\\.codex");
    const env = sandboxEnv("C:\\jetable", { CANARY_FILE: "x" });
    expect(env.CODEX_HOME).toBe("C:\\jetable");
    expect(env.CANARY_FILE).toBe("x");
    expect(env.DATABASE_URL).toBeUndefined();
    expect(env.AUTH_SECRET).toBeUndefined();
  });
});
