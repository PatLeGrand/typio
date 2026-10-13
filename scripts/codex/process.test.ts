import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { killActiveChildren, killTree, runCodex, throwIfInterrupted, watchInterrupts } from "./codex";
import { UnavailableError } from "./errors";
import { readRateLimits } from "./limits";
import { spawnCheck } from "./verify";

/**
 * Tests avec de faux binaires : des scripts Node lancés par `process.execPath`. Ils prouvent ce que
 * les tests purs ne voient pas : délai, arbre de processus, tube cassé, poignée de main JSON-RPC.
 */

let dir: string;
const script = (name: string): string => path.join(dir, name);

const FAKE_CODEX = `
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const mode = process.argv[2];
if (mode === "echo") {
  let input = "";
  process.stdin.on("data", (c) => (input += c));
  process.stdin.on("end", () => {
    console.log(JSON.stringify({ type: "echo", length: input.length }));
    process.exit(0);
  });
} else if (mode === "tree") {
  // Un petit-enfant qui garde le tube de sortie ouvert, comme un processus lancé par Codex.
  const grandchild = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: ["ignore", "inherit", "inherit"] });
  fs.writeFileSync(process.argv[3], String(grandchild.pid));
  setInterval(() => {}, 1000);
} else if (mode === "sleep") {
  setInterval(() => {}, 1000);
} else if (mode === "exit") {
  process.exit(0);
}
`;

const FAKE_APP_SERVER = `
const mode = process.argv[2];
const send = (message) => process.stdout.write(JSON.stringify(message) + "\\n");
const REAL = { ordinaryUsageAllowed: true, rateLimits: { primary: { usedPercent: 12, windowDurationMins: 300, resetsAt: 1791530831 }, secondary: null, rateLimitReachedType: null } };
let buffer = "";
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  for (let end = buffer.indexOf("\\n"); end >= 0; end = buffer.indexOf("\\n")) {
    const message = JSON.parse(buffer.slice(0, end));
    buffer = buffer.slice(end + 1);
    if (message.id === 1) {
      if (mode === "never") return;
      if (mode === "err1") return send({ id: 1, error: { message: "initialisation refusée" } });
      if (mode === "close") process.exit(0);
      send({ id: 1, result: { userAgent: "fake" } });
      // Notification et requête du serveur : elles portent un \`method\`, leur id n'est pas une réponse.
      send({ method: "account/updated", id: 2, params: { authMode: "chatgpt" } });
      send({ method: "item/tool/requestUserInput", id: 1, params: {} });
    } else if (message.id === 2) {
      if (mode === "err2") return send({ id: 2, error: { message: "limites indisponibles" } });
      if (mode === "badresult") return send({ id: 2, result: { rien: true } });
      const line = JSON.stringify({ id: 2, result: REAL }) + "\\n";
      if (mode === "split") {
        // Le message est coupé en plein milieu : le lecteur doit recoller les morceaux.
        const cut = Math.floor(line.length / 2);
        process.stdout.write(line.slice(0, cut));
        setTimeout(() => process.stdout.write(line.slice(cut)), 80);
      } else {
        process.stdout.write(line);
      }
    }
  }
});
`;

beforeAll(() => {
  dir = mkdtempSync(path.join(os.tmpdir(), "typio-codex-proc-"));
  writeFileSync(script("fake-codex.cjs"), FAKE_CODEX);
  writeFileSync(script("fake-app-server.cjs"), FAKE_APP_SERVER);
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
});

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function waitUntil(condition: () => boolean, timeoutMs = 5000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (condition()) return true;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return condition();
}

function fakeCodex(mode: string, extra: string[] = []) {
  return { bin: process.execPath, args: [script("fake-codex.cjs"), mode, ...extra], env: { ...process.env } };
}

describe("runCodex", () => {
  it("rend la sortie et le code d'un processus normal, prompt envoyé sur stdin", async () => {
    const run = await runCodex({ ...fakeCodex("echo"), prompt: "bonjour é", timeoutMinutes: 1 });
    expect(run).toMatchObject({ exitCode: 0, timedOut: false, missing: false });
    expect(run.stdout).toContain('"length":9');
  });

  it("à l'échéance, tue l'arbre entier, petit-enfant compris", async () => {
    const pidFile = path.join(dir, "grandchild.pid");
    const run = await runCodex({ ...fakeCodex("tree", [pidFile]), prompt: "", timeoutMinutes: 0.04 });
    expect(run.timedOut).toBe(true);
    const grandchild = Number(readFileSync(pidFile, "utf8"));
    expect(grandchild).toBeGreaterThan(0);
    expect(await waitUntil(() => !isAlive(grandchild))).toBe(true);
  }, 30_000);

  it("un binaire absent donne missing (ENOENT)", async () => {
    const run = await runCodex({
      bin: path.join(dir, "n-existe-pas.exe"),
      args: [],
      prompt: "x",
      timeoutMinutes: 1,
      env: { ...process.env },
    });
    expect(run.missing).toBe(true);
    expect(run.exitCode).toBeNull();
  });

  it("un tube cassé sur stdin (processus mort avant d'avoir lu) ne fait pas planter", async () => {
    const run = await runCodex({ ...fakeCodex("exit"), prompt: "x".repeat(8 * 1024 * 1024), timeoutMinutes: 1 });
    expect(run.missing).toBe(false);
    expect(run.timedOut).toBe(false);
  });

  it("killActiveChildren arrête les Codex en cours", async () => {
    const pending = runCodex({ ...fakeCodex("sleep"), prompt: "", timeoutMinutes: 5 });
    await new Promise((resolve) => setTimeout(resolve, 500));
    killActiveChildren();
    const run = await pending;
    expect(run.timedOut).toBe(false);
    expect(run.exitCode).not.toBe(0);
  }, 30_000);
});

describe("killTree", () => {
  it("ne fait rien sur un processus déjà terminé : son PID pourrait appartenir à un autre", () => {
    // Si la garde manquait, cet appel tuerait le processus de test lui-même.
    const finished = { pid: process.pid, exitCode: 0, signalCode: null } as unknown as ChildProcess;
    expect(() => killTree(finished)).not.toThrow();
    const killed = { pid: process.pid, exitCode: null, signalCode: "SIGKILL" } as unknown as ChildProcess;
    expect(() => killTree(killed)).not.toThrow();
    expect(isAlive(process.pid)).toBe(true);
  });

  it("tue un processus vivant", async () => {
    const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "ignore" });
    const pid = child.pid ?? 0;
    expect(isAlive(pid)).toBe(true);
    killTree(child);
    expect(await waitUntil(() => !isAlive(pid))).toBe(true);
  });
});

describe("watchInterrupts", () => {
  it("installe puis retire ses écouteurs de signaux", () => {
    const before = process.listenerCount("SIGINT");
    const watch = watchInterrupts();
    expect(process.listenerCount("SIGINT")).toBe(before + 1);
    expect(watch.signal()).toBeNull();
    watch.dispose();
    expect(process.listenerCount("SIGINT")).toBe(before);
  });

  it("throwIfInterrupted lève un Codex indisponible quand un signal a été reçu", () => {
    expect(() => throwIfInterrupted(null)).not.toThrow();
    expect(() => throwIfInterrupted("SIGINT")).toThrow(UnavailableError);
    expect(() => throwIfInterrupted("SIGTERM")).toThrow("interrompu (SIGTERM)");
  });
});

describe("readRateLimits", () => {
  const read = (mode: string, timeoutMs = 10_000) => readRateLimits(process.execPath, timeoutMs, [script("fake-app-server.cjs"), mode]);

  it("fait la poignée de main et lit les limites, en ignorant les messages à method", async () => {
    const { limits, problem } = await read("ok");
    expect(problem).toBe("");
    expect(limits).toMatchObject({ allowed: true, reachedType: null, primary: { usedPercent: 12, durationMins: 300 }, secondary: null });
  });

  it("recolle une réponse coupée entre deux morceaux", async () => {
    const { limits } = await read("split");
    expect(limits?.primary?.usedPercent).toBe(12);
  });

  it("une erreur sur l'id 1 donne des limites inconnues et son message", async () => {
    expect(await read("err1")).toEqual({ limits: null, problem: "initialisation refusée" });
  });

  it("une erreur sur l'id 2 donne des limites inconnues et son message", async () => {
    expect(await read("err2")).toEqual({ limits: null, problem: "limites indisponibles" });
  });

  it("une réponse inattendue donne des limites inconnues", async () => {
    expect(await read("badresult")).toEqual({ limits: null, problem: "réponse inattendue" });
  });

  it("sans réponse, s'arrête au délai", async () => {
    const started = Date.now();
    const result = await read("never", 400);
    expect(result.limits).toBeNull();
    expect(result.problem).toMatch(/délai/);
    expect(Date.now() - started).toBeLessThan(5000);
  });

  it("si le processus se ferme avant de répondre, le dit", async () => {
    const result = await read("close");
    expect(result.limits).toBeNull();
    expect(result.problem).toMatch(/arrêté avant de répondre/);
  });

  it("un binaire absent donne des limites inconnues, sans lever", async () => {
    const result = await readRateLimits(path.join(dir, "n-existe-pas.exe"), 2000);
    expect(result.limits).toBeNull();
    expect(result.problem).not.toBe("");
  });
});

describe("spawnCheck", () => {
  const node = process.execPath;
  const env = { ...process.env };

  it("rend le code de sortie réel, 0 comme non nul", () => {
    expect(spawnCheck(node, ["-e", "console.log('ok')"], dir, env)).toMatchObject({ exitCode: 0 });
    expect(spawnCheck(node, ["-e", "console.error('boum'); process.exit(3)"], dir, env)).toMatchObject({ exitCode: 3 });
    expect(spawnCheck(node, ["-e", "console.error('boum'); process.exit(3)"], dir, env).output).toContain("boum");
  });

  it("un délai donne un code nul et le dit, jamais un succès", () => {
    const result = spawnCheck(node, ["-e", "setTimeout(() => {}, 30000)"], dir, env, 300);
    expect(result.exitCode).toBeNull();
    expect(result.problem).toMatch(/délai/);
  });

  it("un lancement impossible donne un code nul", () => {
    const result = spawnCheck(path.join(dir, "n-existe-pas.exe"), [], dir, env);
    expect(result.exitCode).toBeNull();
    expect(result.problem).toBeTruthy();
  });

  it("travaille dans le dossier demandé", () => {
    const result = spawnCheck(node, ["-e", "console.log(process.cwd())"], dir, env);
    expect(path.resolve(result.output.trim())).toBe(path.resolve(dir));
    expect(existsSync(dir)).toBe(true);
  });
});
