import { spawn } from "node:child_process";
import os from "node:os";
import { asRecord, killTree, safeEnv } from "./codex";
import { UnavailableError } from "./errors";

/**
 * Limites du compte ChatGPT, lues avant chaque tâche : mieux vaut renoncer à Codex que d'arriver
 * au bout d'une tâche d'écriture de 30 minutes sur un quota épuisé. La lecture passe par
 * `codex app-server` (JSON-RPC, une ligne JSON par message sur stdio) ; la décision, pure, est
 * testée dans `limits.test.ts`.
 */

export type RateWindow = {
  usedPercent: number;
  /** Durée de la fenêtre (300 pour 5 h, 10080 pour 7 jours), si Codex la donne. */
  durationMins: number | null;
  /** Secondes Unix. */
  resetsAt: number | null;
};

export type RateLimits = {
  /** `ordinaryUsageAllowed` ; `null` si la réponse ne le dit pas. */
  allowed: boolean | null;
  /** `rateLimitReachedType` ; `null` tant qu'aucune limite n'est atteinte. */
  reachedType: string | null;
  primary: RateWindow | null;
  secondary: RateWindow | null;
};

export const DEFAULT_QUOTA_THRESHOLD = 90;
const READ_TIMEOUT_MS = 30_000;

/** `undefined` : fenêtre invalide (la réponse entière sera jugée inconnue) ; `null` : fenêtre absente. */
function parseWindow(value: unknown): RateWindow | null | undefined {
  if (value === null || value === undefined) return null;
  const window = asRecord(value);
  if (!window || typeof window.usedPercent !== "number" || !Number.isFinite(window.usedPercent)) return undefined;
  return {
    usedPercent: window.usedPercent,
    durationMins: typeof window.windowDurationMins === "number" ? window.windowDurationMins : null,
    resetsAt: typeof window.resetsAt === "number" ? window.resetsAt : null,
  };
}

/**
 * Lit le `result` de `account/rateLimits/read`. Renvoie `null` (limites inconnues) si la réponse
 * n'a pas la forme attendue : ni booléen `ordinaryUsageAllowed`, ni objet `rateLimits`, ou une
 * fenêtre sans pourcentage.
 */
export function parseRateLimits(result: unknown): RateLimits | null {
  const root = asRecord(result);
  if (!root) return null;
  const allowed = typeof root.ordinaryUsageAllowed === "boolean" ? root.ordinaryUsageAllowed : null;
  const limits = asRecord(root.rateLimits);
  if (allowed === null && !limits) return null;

  const primary = parseWindow(limits?.primary);
  const secondary = parseWindow(limits?.secondary);
  if (primary === undefined || secondary === undefined) return null;
  const reached = limits?.rateLimitReachedType;
  return {
    allowed,
    reachedType: reached === null || reached === undefined ? null : String(reached),
    primary,
    secondary,
  };
}

function formatDuration(minutes: number | null, fallback: string): string {
  if (minutes === null) return fallback;
  if (minutes < 120) return `${minutes} min`;
  if (minutes < 48 * 60) return `${Math.round(minutes / 60)} h`;
  return `${Math.round(minutes / (24 * 60))} j`;
}

/** Heure locale de remise à zéro, lisible (jour, mois, heure). */
export function formatReset(resetsAt: number, timeZone?: string): string {
  return new Date(resetsAt * 1000).toLocaleString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  });
}

export type QuotaDecision =
  | { status: "ok" }
  | { status: "blocked"; reason: string }
  | { status: "unknown" };

/**
 * Décide si Codex est utilisable : refusé si l'usage ordinaire est interdit, si une limite est
 * atteinte, ou si l'une des deux fenêtres est à `threshold` % ou plus. Des limites inconnues
 * ne bloquent pas : Codex échouera de lui-même si le quota est vraiment épuisé.
 */
export function decideQuota(limits: RateLimits | null, threshold: number, timeZone?: string): QuotaDecision {
  if (limits === null) return { status: "unknown" };

  const reasons: string[] = [];
  if (limits.allowed === false) reasons.push("usage ordinaire refusé par ChatGPT");
  if (limits.reachedType !== null) reasons.push(`limite atteinte (${limits.reachedType})`);

  const windows = [
    { window: limits.primary, fallback: "fenêtre courte" },
    { window: limits.secondary, fallback: "fenêtre longue" },
  ].flatMap(({ window, fallback }) => (window ? [{ window, label: formatDuration(window.durationMins, fallback) }] : []));
  const details = windows.map(({ window, label }) => {
    const reset = window.resetsAt === null ? "" : `, remise à zéro ${formatReset(window.resetsAt, timeZone)}`;
    return `${label} à ${window.usedPercent} %${reset}`;
  });
  const reached = windows.filter(({ window }) => window.usedPercent >= threshold);
  if (reached.length > 0) reasons.push(`seuil de ${threshold} % atteint`);

  if (reasons.length === 0) return { status: "ok" };
  return { status: "blocked", reason: `quota : ${reasons.join(", ")} (${details.join(" ; ") || "aucune fenêtre rapportée"}).` };
}

export type RateLimitsRead = { limits: RateLimits | null; problem: string };

/**
 * Interroge `codex app-server`. Ne lève jamais : toute difficulté (binaire, délai de 30 s,
 * réponse inattendue) donne des limites `null` et une explication.
 */
export function readRateLimits(bin: string, timeoutMs = READ_TIMEOUT_MS, leadingArgs: readonly string[] = []): Promise<RateLimitsRead> {
  return new Promise<RateLimitsRead>((resolve) => {
    const child = spawn(bin, [...leadingArgs, "app-server"], {
      env: safeEnv(),
      cwd: os.tmpdir(),
      windowsHide: true,
      detached: process.platform !== "win32",
    });
    let settled = false;
    let buffer = "";
    const finish = (outcome: RateLimitsRead) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      killTree(child);
      resolve(outcome);
    };
    const timer = setTimeout(() => finish({ limits: null, problem: `délai de ${timeoutMs / 1000} s dépassé` }), timeoutMs);
    const send = (message: Record<string, unknown>) => child.stdin.write(`${JSON.stringify(message)}\n`);

    const handle = (line: string) => {
      let message: Record<string, unknown> | null;
      try {
        message = asRecord(JSON.parse(line));
      } catch {
        return;
      }
      // Notifications (`account/updated`…) et requêtes du serveur portent un `method` : leur `id`
      // n'est pas celui d'une réponse à nos requêtes.
      if (!message || "method" in message) return;
      if (message.id === 1 && message.error === undefined) {
        send({ method: "initialized" });
        send({ id: 2, method: "account/rateLimits/read" });
      } else if (message.id === 1 || message.id === 2) {
        if (message.error !== undefined) {
          const detail = asRecord(message.error)?.message;
          finish({ limits: null, problem: typeof detail === "string" ? detail : "erreur JSON-RPC" });
        } else {
          const limits = parseRateLimits(message.result);
          finish({ limits, problem: limits ? "" : "réponse inattendue" });
        }
      }
    };

    child.stdout.setEncoding("utf8").on("data", (chunk: string) => {
      buffer += chunk;
      for (let end = buffer.indexOf("\n"); end >= 0; end = buffer.indexOf("\n")) {
        handle(buffer.slice(0, end).trim());
        buffer = buffer.slice(end + 1);
      }
    });
    child.stderr.resume();
    child.on("error", (error) => finish({ limits: null, problem: error.message }));
    child.on("close", () => finish({ limits: null, problem: "app-server arrêté avant de répondre" }));
    child.stdin.on("error", () => {});
    send({ id: 1, method: "initialize", params: { clientInfo: { name: "typio", title: "Typio", version: "0.0.1" } } });
  });
}

/**
 * Contrôle du quota avant le canari et avant `codex exec`. Lève `UnavailableError` si le quota
 * est atteint ; si les limites sont illisibles, avertit sur stderr et laisse continuer.
 */
export async function ensureQuota(bin: string, threshold: number): Promise<void> {
  const { limits, problem } = await readRateLimits(bin);
  const decision = decideQuota(limits, threshold);
  if (decision.status === "blocked") throw new UnavailableError(decision.reason);
  if (decision.status === "unknown") {
    console.error(`AVERTISSEMENT : limites ChatGPT illisibles (${problem}) ; on continue, Codex échouera de lui-même si le quota est atteint.`);
  }
}
