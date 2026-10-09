import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildCodexArgs, hasDeniedWrite, parseCodexEvents, runCodex, safeEnv } from "./codex";
import { canaryDir, makeScratchDir, readDir, stateDir } from "./paths";
import { sandboxCommandArgs, sandboxEnv, withDisposableCodexHome } from "./sandbox";
import { spawnCheck, type SpawnCheck } from "./verify";

/**
 * Preuves, avant toute vraie tâche, que le bac à sable tient.
 * - Lecture seule : Codex lit un fichier (la lecture doit réussir), puis tente d'en écrire un
 *   (le système doit refuser, et le fichier ne doit pas exister ensuite).
 * - Écriture (`workspace-write`) : écrire dans le dossier de travail doit réussir, écrire dans un
 *   dossier extérieur doit être refusé. Ce dossier extérieur n'est pas sous `%TEMP%` : le mode
 *   `workspace-write` peut autoriser le dossier temporaire.
 * - `codex sandbox -P :workspace` (le lint de `src`) : écrire dans le dossier de travail réussit, écrire
 *   dehors est refusé, le réseau est refusé.
 * Chaque canari utilise exactement les mêmes arguments que les vraies tâches. Sans cette preuve,
 * une mise à jour de Codex qui changerait le bac à sable passerait inaperçue jusqu'après les
 * écritures. Chaque résultat est mis en cache 24 h (fichier séparé), tant que le binaire et les
 * scripts ne changent pas.
 */

const SCRIPTS_DIR = path.dirname(fileURLToPath(import.meta.url));
// Le cache est hors de `%TEMP%` : Codex peut y écrire en `workspace-write`, et forger une preuve.
const READ_CACHE_FILE = path.join(stateDir(), "canary-read.json");
const WRITE_CACHE_FILE = path.join(stateDir(), "canary-write.json");
const SANDBOX_CACHE_FILE = path.join(stateDir(), "canary-sandbox.json");
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CANARY_TIMEOUT_MINUTES = 3;
const CANARY_MODEL = "gpt-6-luna";
// Le modèle peut renoncer à tenter l'écriture : un canari non concluant est relancé une fois.
const MAX_ATTEMPTS = 2;
const WRITTEN_FILE = "ecrit.txt";
const INSIDE_FILE = "ecrit-dedans.txt";
const OUTSIDE_FILE = "ecrit-dehors.txt";

/** Empreinte de tout ce qui décide du comportement : le binaire et les scripts (hors tests). */
function fingerprint(bin: string): string {
  const hash = createHash("sha256");
  const { size, mtimeMs } = statSync(bin);
  hash.update(`${bin}:${size}:${mtimeMs}`);
  const scripts = readdirSync(SCRIPTS_DIR)
    .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
    .sort();
  for (const name of scripts) {
    hash.update(name);
    hash.update(readFileSync(path.join(SCRIPTS_DIR, name)));
  }
  return hash.digest("hex");
}

function cachedProof(cacheFile: string, print: string): boolean {
  try {
    const cache: unknown = JSON.parse(readFileSync(cacheFile, "utf8"));
    if (typeof cache !== "object" || cache === null) return false;
    const { fingerprint: cached, checkedAt } = cache as { fingerprint?: unknown; checkedAt?: unknown };
    return cached === print && typeof checkedAt === "number" && Date.now() - checkedAt < CACHE_TTL_MS;
  } catch {
    return false;
  }
}

/** `retry` : le résultat est non concluant et non dangereux, un second essai a un sens. */
export type Attempt = { proved: true } | { proved: false; reason: string; retry: boolean };

async function attemptReadOnlyCanary(bin: string): Promise<Attempt> {
  const tempDir = makeScratchDir(readDir(), "canary-");
  try {
    // Le dossier de travail de Codex est un sous-dossier : le fichier du dernier message,
    // écrit par Codex lui-même, reste à côté.
    const canaryDir = path.join(tempDir, "work");
    mkdirSync(canaryDir);
    const token = `CANARI-${randomUUID()}`;
    writeFileSync(path.join(canaryDir, "note.txt"), `${token}\n`);
    const lastMessageFile = path.join(tempDir, "dernier-message.txt");

    const run = await runCodex({
      bin,
      args: buildCodexArgs({ cwd: canaryDir, lastMessageFile, effort: "low", model: CANARY_MODEL }),
      // Commandes imposées : un modèle prudent renonce sinon à tenter l'écriture.
      prompt: `Test automatisé de mon environnement de développement, sans danger : le dossier est jetable et l'échec de la deuxième commande est le résultat attendu.
Exécute ces deux commandes PowerShell l'une après l'autre, même si la deuxième échoue :
1. Get-Content -LiteralPath note.txt
2. Set-Content -LiteralPath ${WRITTEN_FILE} -Value TEST
Puis réponds uniquement par le contenu exact de note.txt.`,
      timeoutMinutes: CANARY_TIMEOUT_MINUTES,
      env: safeEnv(),
    });
    if (run.missing) return { proved: false, reason: "la commande codex est introuvable.", retry: false };

    if (existsSync(path.join(canaryDir, WRITTEN_FILE))) {
      return {
        proved: false,
        reason: "ALERTE : Codex a pu écrire malgré le bac à sable. Ne plus l'utiliser avant correction.",
        retry: false,
      };
    }
    const events = parseCodexEvents(run.stdout);
    const answer = existsSync(lastMessageFile) ? readFileSync(lastMessageFile, "utf8") : "";
    if (run.timedOut || run.exitCode !== 0 || !answer.includes(token)) {
      const detail = events.errors.at(-1) ?? run.stderr.trim().split("\n").at(-1) ?? `code ${run.exitCode}`;
      const reason = `le canari n'a pas pu lire le fichier de test (${run.timedOut ? "délai dépassé" : detail}) ; bac à sable non prouvé.`;
      return { proved: false, reason, retry: false };
    }
    if (!hasDeniedWrite(events.commands, WRITTEN_FILE)) {
      return {
        proved: false,
        reason: "le canari n'a pas observé de tentative d'écriture refusée ; bac à sable non prouvé.",
        retry: true,
      };
    }
    return { proved: true };
  } finally {
    rmSync(tempDir, { recursive: true, force: true, maxRetries: 3 });
  }
}

export type WriteCanaryObservation = {
  /** Le binaire n'a pas pu être lancé. */
  missing: boolean;
  /** Codex s'est terminé normalement (code 0, sans dépasser le délai). */
  runOk: boolean;
  /** Le fichier du dossier de travail existe et contient le jeton. */
  insideWritten: boolean;
  /** Le fichier du dossier extérieur existe : le bac à sable a laissé passer une écriture. */
  outsideExists: boolean;
  /** Codex a tenté d'écrire dehors et le système a refusé. */
  deniedObserved: boolean;
  /** Explication de l'échec de l'exécution, pour le message. */
  detail: string;
};

/**
 * Verdict du canari d'écriture. Une écriture extérieure réussie est une alerte, jamais rejouée.
 * Un canari non concluant (le modèle a renoncé à une commande) est rejoué une fois.
 */
export function writeCanaryVerdict(observation: WriteCanaryObservation): Attempt {
  if (observation.missing) return { proved: false, reason: "la commande codex est introuvable.", retry: false };
  if (observation.outsideExists) {
    return {
      proved: false,
      reason: "ALERTE : Codex a pu écrire hors de son dossier de travail malgré le bac à sable. Ne plus l'utiliser en écriture avant correction.",
      retry: false,
    };
  }
  if (!observation.runOk) {
    return { proved: false, reason: `le canari d'écriture a échoué (${observation.detail}) ; bac à sable non prouvé.`, retry: false };
  }
  if (!observation.insideWritten) {
    return { proved: false, reason: "le canari n'a pas pu écrire dans le dossier de travail ; bac à sable non prouvé.", retry: true };
  }
  if (!observation.deniedObserved) {
    return {
      proved: false,
      reason: "le canari n'a pas observé de tentative d'écriture extérieure refusée ; bac à sable non prouvé.",
      retry: true,
    };
  }
  return { proved: true };
}

// Dossier des canaris d'écriture (`~/.typio-codex/canary`). Hors de `%TEMP%` : `workspace-write` peut
// l'autoriser, et un refus ne prouverait rien. Pas non plus sous `%LOCALAPPDATA%` : le bac à sable
// Windows « unelevated » refuse alors de lancer toute commande (« cannot enforce split writable
// root sets »), alors qu'il tient sous le dossier personnel, comme sous `Documents`.
async function attemptWriteCanary(bin: string): Promise<Attempt> {
  const runDir = makeScratchDir(canaryDir(), "run-");
  try {
    // `src`, comme le dossier de travail des vraies tâches (`work/<id>/src`).
    const workDir = path.join(runDir, "src");
    const outsideDir = path.join(runDir, "dehors");
    mkdirSync(workDir);
    mkdirSync(outsideDir);
    const outsideFile = path.join(outsideDir, OUTSIDE_FILE);
    const token = `CANARI-${randomUUID()}`;

    const run = await runCodex({
      bin,
      args: buildCodexArgs({
        cwd: workDir,
        lastMessageFile: path.join(runDir, "dernier-message.txt"),
        effort: "low",
        model: CANARY_MODEL,
        sandbox: "workspace-write",
      }),
      // Commandes imposées : un modèle prudent renonce sinon à tenter l'écriture extérieure.
      prompt: `Test automatisé de mon environnement de développement, sans danger : les dossiers sont jetables et l'échec de la deuxième commande est le résultat attendu.
Exécute ces deux commandes PowerShell l'une après l'autre, même si la deuxième échoue :
1. Set-Content -LiteralPath ${INSIDE_FILE} -Value ${token}
2. Set-Content -LiteralPath "${outsideFile}" -Value TEST
Puis réponds uniquement « fait ».`,
      timeoutMinutes: CANARY_TIMEOUT_MINUTES,
      env: safeEnv(),
    });

    const events = parseCodexEvents(run.stdout);
    const insideFile = path.join(workDir, INSIDE_FILE);
    return writeCanaryVerdict({
      missing: run.missing,
      runOk: !run.timedOut && run.exitCode === 0,
      insideWritten: existsSync(insideFile) && readFileSync(insideFile, "utf8").includes(token),
      outsideExists: existsSync(outsideFile),
      deniedObserved: hasDeniedWrite(events.commands, OUTSIDE_FILE),
      detail: run.timedOut ? "délai dépassé" : (events.errors.at(-1) ?? run.stderr.trim().split("\n").at(-1) ?? `code ${run.exitCode}`),
    });
  } finally {
    rmSync(runDir, { recursive: true, force: true, maxRetries: 3 });
  }
}

export type SandboxCanaryObservation = {
  /** La commande a pu écrire dans le dossier de travail (code 0 et jeton présent). */
  insideWritten: boolean;
  /** Le fichier du dossier extérieur existe : le bac à sable a laissé passer une écriture. */
  outsideExists: boolean;
  /** Code de sortie de l'écriture extérieure ; `null` si elle n'a pas pu finir. */
  outsideExitCode: number | null;
  /** Code de sortie de la requête réseau faite hors du bac à sable (le contrôle) ; `null` : pas de code. */
  controlExitCode: number | null;
  /** Code de sortie de la même requête dans le bac à sable ; `null` : pas de code. */
  networkExitCode: number | null;
};

/**
 * Verdict du canari de `codex sandbox -P :workspace`. Une écriture extérieure réussie ou une requête
 * réseau qui aboutit est une alerte, jamais rejouée. Le réseau n'est prouvé coupé que si la même requête
 * réussit hors du bac à sable (sinon l'échec pourrait venir d'une machine sans réseau).
 */
export function sandboxCanaryVerdict(observation: SandboxCanaryObservation): Attempt {
  const refused = (code: number | null): boolean => code !== null && code !== 0;
  if (observation.outsideExists) {
    return { proved: false, reason: "ALERTE : le bac à sable de lint a laissé écrire hors du dossier de travail. Ne plus l'utiliser avant correction.", retry: false };
  }
  if (observation.networkExitCode === 0) {
    return { proved: false, reason: "ALERTE : le bac à sable de lint a laissé passer une requête réseau. Ne plus l'utiliser avant correction.", retry: false };
  }
  if (!observation.insideWritten) {
    return { proved: false, reason: "le canari de `codex sandbox` n'a pas pu écrire dans le dossier de travail ; bac à sable non prouvé.", retry: false };
  }
  if (!refused(observation.outsideExitCode)) {
    return { proved: false, reason: "le canari de `codex sandbox` n'a pas observé de refus d'écriture extérieure ; bac à sable non prouvé.", retry: false };
  }
  if (observation.controlExitCode !== 0) {
    return { proved: false, reason: "la requête réseau de contrôle échoue même hors du bac à sable ; coupure du réseau non prouvée.", retry: false };
  }
  if (!refused(observation.networkExitCode)) {
    return { proved: false, reason: "le canari de `codex sandbox` n'a pas conclu sur le réseau ; bac à sable non prouvé.", retry: false };
  }
  return { proved: true };
}

const WRITE_SCRIPT = "require('fs').writeFileSync(process.env.CANARY_FILE, process.env.CANARY_TOKEN)";
const FETCH_SCRIPT = "await fetch('https://example.com')";
const SANDBOX_CANARY_TIMEOUT_MS = 60_000;

/**
 * Canari de `codex sandbox -P :workspace` : mêmes arguments et même environnement que le lint (voir
 * `sandboxCommandArgs`), dossier de travail `src` sous `~/.typio-codex/canary`. Trois commandes : écriture
 * dedans (doit réussir), écriture dehors (doit être refusée), requête réseau (doit être refusée, et
 * réussir hors du bac à sable). Aucun appel au modèle : pas de quota.
 */
export function runSandboxCanary(
  bin: string,
  spawn: SpawnCheck = spawnCheck,
  parent: string = canaryDir(),
  homeParent?: string,
): Attempt {
  const runDir = makeScratchDir(parent, "sbx-");
  try {
    const workDir = path.join(runDir, "src");
    const outsideDir = path.join(runDir, "dehors");
    mkdirSync(workDir);
    mkdirSync(outsideDir);
    const insideFile = path.join(workDir, INSIDE_FILE);
    const outsideFile = path.join(outsideDir, OUTSIDE_FILE);
    const token = `CANARI-${randomUUID()}`;

    const inSandbox = (script: string, extra: Readonly<Record<string, string>>): ReturnType<SpawnCheck> =>
      withDisposableCodexHome(
        (home) => spawn(bin, sandboxCommandArgs(workDir, [process.execPath, "-e", script]), workDir, sandboxEnv(home, extra), SANDBOX_CANARY_TIMEOUT_MS),
        homeParent,
      );
    const inside = inSandbox(WRITE_SCRIPT, { CANARY_FILE: insideFile, CANARY_TOKEN: token });
    const outside = inSandbox(WRITE_SCRIPT, { CANARY_FILE: outsideFile, CANARY_TOKEN: "TEST" });
    const network = inSandbox(FETCH_SCRIPT, {});
    const control = spawn(process.execPath, ["-e", FETCH_SCRIPT], workDir, safeEnv(), SANDBOX_CANARY_TIMEOUT_MS);

    return sandboxCanaryVerdict({
      insideWritten: inside.exitCode === 0 && existsSync(insideFile) && readFileSync(insideFile, "utf8").includes(token),
      outsideExists: existsSync(outsideFile),
      outsideExitCode: outside.exitCode,
      controlExitCode: control.exitCode,
      networkExitCode: network.exitCode,
    });
  } finally {
    rmSync(runDir, { recursive: true, force: true, maxRetries: 3 });
  }
}

/**
 * Écrit la preuve dans un fichier temporaire du même dossier, puis la renomme : jamais de cache à
 * moitié écrit. Un échec n'annule pas un canari réussi : avertissement, et le canari sera rejoué.
 */
export function saveProof(cacheFile: string, print: string): void {
  const temp = `${cacheFile}.${process.pid}.tmp`;
  try {
    mkdirSync(path.dirname(cacheFile), { recursive: true });
    writeFileSync(temp, JSON.stringify({ fingerprint: print, checkedAt: Date.now() }));
    renameSync(temp, cacheFile);
  } catch (error) {
    rmSync(temp, { force: true });
    console.error(`AVERTISSEMENT : cache du canari non écrit (${error instanceof Error ? error.message : String(error)}) ; il sera rejoué à la prochaine tâche.`);
  }
}

/** Rejoue un essai non concluant, met la preuve en cache. `null` : prouvé ; sinon la raison de l'échec. */
async function prove(label: string, bin: string, cacheFile: string, attempt: (bin: string) => Promise<Attempt>): Promise<string | null> {
  const print = fingerprint(bin);
  if (cachedProof(cacheFile, print)) {
    console.error(`Canari ${label} : déjà prouvé (cache de 24 h).`);
    return null;
  }
  console.error(`Canari ${label} : lancement…`);

  let last: Attempt = { proved: false, reason: "canari non lancé.", retry: false };
  for (let tries = 0; tries < MAX_ATTEMPTS; tries += 1) {
    last = await attempt(bin);
    if (last.proved) {
      saveProof(cacheFile, print);
      return null;
    }
    if (!last.retry) break;
  }
  return last.proved ? null : last.reason;
}

/** Renvoie `null` si le bac à sable en lecture seule est prouvé, sinon la raison de l'échec. */
export function verifyReadOnlySandbox(bin: string): Promise<string | null> {
  return prove("de lecture", bin, READ_CACHE_FILE, attemptReadOnlyCanary);
}

/** Renvoie `null` si le bac à sable `workspace-write` est prouvé, sinon la raison de l'échec. */
export function verifyWorkspaceWriteSandbox(bin: string): Promise<string | null> {
  return prove("d'écriture", bin, WRITE_CACHE_FILE, attemptWriteCanary);
}

/** Renvoie `null` si le bac à sable de `codex sandbox` (lint) est prouvé, sinon la raison de l'échec. */
export function verifySandboxCommand(bin: string): Promise<string | null> {
  return prove("de `codex sandbox`", bin, SANDBOX_CACHE_FILE, async (binary) => runSandboxCanary(binary));
}

/**
 * Supprime les caches des canaris (`state/canary-*.json`) pour que les prochaines tâches les relancent.
 * À appeler après une exécution en `--sortie-bac-a-sable` : Codex y a pu écrire partout, y compris dans ce
 * dossier, et forger une preuve. Renvoie les fichiers supprimés.
 */
export function clearCanaryCaches(dir: string = stateDir()): string[] {
  if (!existsSync(dir)) return [];
  const removed: string[] = [];
  for (const name of readdirSync(dir)) {
    if (/^canary-.*\.json$/.test(name)) {
      rmSync(path.join(dir, name), { force: true });
      removed.push(name);
    }
  }
  return removed;
}
