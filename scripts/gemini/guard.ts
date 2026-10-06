import { appendFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { decideToolCall, GUARD_LOG_ENV, ROOTS_ENV, type Decision, type ToolCall } from "./policy";

/**
 * Hook `PreToolUse` de `agy`, déclaré dans `sandbox/.agents/hooks.json`.
 * Lit l'appel d'outil sur stdin et répond `allow` ou `deny` sur stdout.
 * Toute erreur fait échouer le hook, et `agy` bloque alors l'outil.
 */

function resolveTarget(call: ToolCall): string | null {
  const requested = call.args?.AbsolutePath;
  if (typeof requested !== "string" || requested === "") return null;
  try {
    // La version native résout aussi les noms courts 8.3 ; la version JS les laisse tels quels.
    return realpathSync.native(requested);
  } catch {
    // Fichier absent ou chemin invalide : rien à lire, on refuse.
    return null;
  }
}

let raw = "";
for await (const chunk of process.stdin) raw += chunk;
const payload: unknown = JSON.parse(raw);
const call: ToolCall =
  typeof payload === "object" && payload !== null && "toolCall" in payload && typeof payload.toolCall === "object"
    ? (payload.toolCall as ToolCall)
    : {};

const roots = (process.env[ROOTS_ENV] ?? "").split(path.delimiter).filter(Boolean);
const target = resolveTarget(call);
const decision: Decision = decideToolCall(call, roots, target);

const logFile = process.env[GUARD_LOG_ENV];
if (logFile) {
  appendFileSync(logFile, `${decision.decision}\t${String(call.name)}\t${target ?? ""}\n`);
}

console.log(JSON.stringify(decision));
