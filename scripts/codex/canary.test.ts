import { existsSync, mkdtempSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  clearCanaryCaches,
  runSandboxCanary,
  sandboxCanaryVerdict,
  writeCanaryVerdict,
  type SandboxCanaryObservation,
  type WriteCanaryObservation,
} from "./canary";
import type { SpawnCheck } from "./verify";

const proved: WriteCanaryObservation = {
  missing: false,
  runOk: true,
  insideWritten: true,
  outsideExists: false,
  deniedObserved: true,
  detail: "",
};

describe("writeCanaryVerdict", () => {
  it("prouve le bac à sable : écriture dedans réussie, écriture dehors refusée", () => {
    expect(writeCanaryVerdict(proved)).toEqual({ proved: true });
  });

  it("donne une ALERTE, sans nouvel essai, quand l'écriture extérieure a réussi", () => {
    const verdict = writeCanaryVerdict({ ...proved, outsideExists: true, deniedObserved: false });
    expect(verdict).toMatchObject({ proved: false, retry: false });
    if (!verdict.proved) expect(verdict.reason).toMatch(/^ALERTE/);
  });

  it("l'alerte prime sur toute autre observation", () => {
    const verdict = writeCanaryVerdict({ ...proved, outsideExists: true, runOk: false, insideWritten: false });
    if (!verdict.proved) expect(verdict.reason).toMatch(/^ALERTE/);
  });

  it("ne prouve rien si l'écriture dans le dossier de travail a échoué, et rejoue une fois", () => {
    expect(writeCanaryVerdict({ ...proved, insideWritten: false })).toMatchObject({ proved: false, retry: true });
  });

  it("ne prouve rien si aucun refus n'a été observé (le modèle a renoncé), et rejoue une fois", () => {
    expect(writeCanaryVerdict({ ...proved, deniedObserved: false })).toMatchObject({ proved: false, retry: true });
  });

  it("ne rejoue pas une exécution en échec ou un binaire introuvable", () => {
    const failed = writeCanaryVerdict({ ...proved, runOk: false, detail: "délai dépassé" });
    expect(failed).toMatchObject({ proved: false, retry: false });
    if (!failed.proved) expect(failed.reason).toContain("délai dépassé");
    expect(writeCanaryVerdict({ ...proved, missing: true })).toMatchObject({ proved: false, retry: false });
  });
});

describe("sandboxCanaryVerdict : canari de codex sandbox", () => {
  const ok: SandboxCanaryObservation = {
    insideWritten: true,
    outsideExists: false,
    outsideExitCode: 1,
    controlExitCode: 0,
    networkExitCode: 1,
  };

  it("prouvé : écriture dedans réussie, écriture dehors et réseau refusés (le réseau marche hors du bac à sable)", () => {
    expect(sandboxCanaryVerdict(ok)).toEqual({ proved: true });
  });

  it("ALERTE, sans nouvel essai, si une écriture extérieure a réussi", () => {
    const verdict = sandboxCanaryVerdict({ ...ok, outsideExists: true, outsideExitCode: 0 });
    expect(verdict).toMatchObject({ proved: false, retry: false });
    if (!verdict.proved) expect(verdict.reason).toMatch(/^ALERTE.*écrire hors/);
  });

  it("ALERTE si la requête réseau a abouti dans le bac à sable", () => {
    const verdict = sandboxCanaryVerdict({ ...ok, networkExitCode: 0 });
    expect(verdict).toMatchObject({ proved: false, retry: false });
    if (!verdict.proved) expect(verdict.reason).toMatch(/^ALERTE.*réseau/);
  });

  it("ne prouve rien si l'écriture dans le dossier de travail a échoué", () => {
    const verdict = sandboxCanaryVerdict({ ...ok, insideWritten: false });
    expect(verdict).toMatchObject({ proved: false });
    if (!verdict.proved) expect(verdict.reason).not.toMatch(/^ALERTE/);
  });

  it("ne prouve rien si l'écriture extérieure n'a pas été refusée (code 0 ou sans code)", () => {
    expect(sandboxCanaryVerdict({ ...ok, outsideExitCode: 0 })).toMatchObject({ proved: false });
    expect(sandboxCanaryVerdict({ ...ok, outsideExitCode: null })).toMatchObject({ proved: false });
  });

  it("ne prouve rien si le réseau est coupé aussi hors du bac à sable (machine hors ligne)", () => {
    const verdict = sandboxCanaryVerdict({ ...ok, controlExitCode: 1 });
    expect(verdict).toMatchObject({ proved: false });
    if (!verdict.proved) expect(verdict.reason).toContain("hors du bac à sable");
    expect(sandboxCanaryVerdict({ ...ok, controlExitCode: null })).toMatchObject({ proved: false });
  });

  it("ne prouve rien si la requête réseau du bac à sable n'a pas de code (délai)", () => {
    expect(sandboxCanaryVerdict({ ...ok, networkExitCode: null })).toMatchObject({ proved: false });
  });
});

describe("runSandboxCanary : arguments et environnement des trois commandes", () => {
  const temps: string[] = [];
  afterEach(() => {
    for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
  });
  const tempDir = (): string => {
    const dir = realpathSync.native(mkdtempSync(path.join(os.tmpdir(), "typio-codex-sbxcanary-")));
    temps.push(dir);
    return dir;
  };

  type Call = { bin: string; args: readonly string[]; cwd: string; env: NodeJS.ProcessEnv; homeExisted: boolean };

  /** Un faux bac à sable : écrit dans `cwd` seulement, sauf `leak`, et coupe le réseau sauf `networkOpen`. */
  function fakeSpawn(options: { leak?: boolean; networkOpen?: boolean; controlExit?: number } = {}) {
    const calls: Call[] = [];
    const spawn: SpawnCheck = (bin, args, cwd, env) => {
      calls.push({ bin, args: [...args], cwd, env, homeExisted: env.CODEX_HOME !== undefined && existsSync(env.CODEX_HOME) });
      const sandboxed = args[0] === "sandbox";
      const script = String(args[args.indexOf("-e") + 1]);
      if (script.includes("writeFileSync")) {
        const target = String(env.CANARY_FILE);
        const inside = path.dirname(target) === cwd;
        if (sandboxed && !inside && !options.leak) return { exitCode: 1, output: "EPERM" };
        writeFileSync(target, String(env.CANARY_TOKEN));
        return { exitCode: 0, output: "" };
      }
      if (sandboxed) return { exitCode: options.networkOpen ? 0 : 1, output: "" };
      return { exitCode: options.controlExit ?? 0, output: "" };
    };
    return { calls, spawn };
  }

  it("AC-5 : prouvé ; trois commandes en bac à sable (:workspace, réseau coupé, CODEX_HOME jetable) plus un contrôle réseau", () => {
    const { calls, spawn } = fakeSpawn();
    const parent = tempDir();
    const homes = tempDir();
    expect(runSandboxCanary("codex.exe", spawn, parent, homes)).toEqual({ proved: true });

    const sandboxed = calls.filter((call) => call.args[0] === "sandbox");
    const control = calls.filter((call) => call.args[0] !== "sandbox");
    expect(sandboxed).toHaveLength(3);
    expect(control).toHaveLength(1);
    expect(control[0]?.bin).toBe(process.execPath);

    for (const call of sandboxed) {
      expect(call.bin).toBe("codex.exe");
      expect(call.args.slice(0, 5)).toEqual(["sandbox", "-P", ":workspace", "-C", call.cwd]);
      expect(path.basename(call.cwd)).toBe("src");
      expect(call.args).toContain("sandbox_workspace_write.network_access=false");
      expect(call.args).toContain('windows.sandbox="unelevated"');
      expect(call.args[call.args.indexOf("--") + 1]).toBe(process.execPath);
      // CODEX_HOME jetable : sous le dossier prévu, présent pendant la commande, supprimé ensuite.
      expect(path.dirname(String(call.env.CODEX_HOME))).toBe(homes);
      expect(call.homeExisted).toBe(true);
      expect(existsSync(String(call.env.CODEX_HOME))).toBe(false);
      expect(call.env.DATABASE_URL).toBeUndefined();
    }
    expect(new Set(sandboxed.map((call) => call.env.CODEX_HOME)).size).toBe(3);
    // Le dossier du canari est supprimé.
    expect(readdirSync(parent)).toEqual([]);
  });

  it("l'écriture extérieure se fait dans un dossier frère de src, pas dans src", () => {
    const { calls, spawn } = fakeSpawn();
    runSandboxCanary("codex.exe", spawn, tempDir(), tempDir());
    const [inside, outside] = calls.filter((call) => call.args[0] === "sandbox");
    expect(path.dirname(String(inside?.env.CANARY_FILE))).toBe(inside?.cwd);
    expect(path.dirname(String(outside?.env.CANARY_FILE))).not.toBe(outside?.cwd);
    expect(path.dirname(path.dirname(String(outside?.env.CANARY_FILE)))).toBe(path.dirname(String(outside?.cwd)));
  });

  it("ALERTE quand le faux bac à sable laisse écrire dehors", () => {
    const verdict = runSandboxCanary("codex.exe", fakeSpawn({ leak: true }).spawn, tempDir(), tempDir());
    expect(verdict).toMatchObject({ proved: false });
    if (!verdict.proved) expect(verdict.reason).toMatch(/^ALERTE/);
  });

  it("ALERTE quand le réseau passe dans le bac à sable ; non prouvé quand le contrôle échoue (hors ligne)", () => {
    const open = runSandboxCanary("codex.exe", fakeSpawn({ networkOpen: true }).spawn, tempDir(), tempDir());
    expect(open).toMatchObject({ proved: false });
    if (!open.proved) expect(open.reason).toMatch(/^ALERTE/);
    const offline = runSandboxCanary("codex.exe", fakeSpawn({ controlExit: 1 }).spawn, tempDir(), tempDir());
    expect(offline).toMatchObject({ proved: false });
    if (!offline.proved) expect(offline.reason).not.toMatch(/^ALERTE/);
  });
});

describe("clearCanaryCaches", () => {
  it("supprime state/canary-*.json et rien d'autre", () => {
    const dir = realpathSync.native(mkdtempSync(path.join(os.tmpdir(), "typio-codex-clear-")));
    try {
      for (const name of ["canary-read.json", "canary-write.json", "canary-sandbox.json", "limits.json", "canary.txt", "x-canary-y.json"]) {
        writeFileSync(path.join(dir, name), "{}");
      }
      expect(clearCanaryCaches(dir).sort()).toEqual(["canary-read.json", "canary-sandbox.json", "canary-write.json"]);
      expect(readdirSync(dir).sort()).toEqual(["canary.txt", "limits.json", "x-canary-y.json"]);
      expect(clearCanaryCaches(dir)).toEqual([]);
      expect(clearCanaryCaches(path.join(dir, "absent"))).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
    }
  });
});

