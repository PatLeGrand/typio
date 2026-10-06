import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { runAgy, SANDBOX_DIR } from "./agy";
import { GUARD_LOG_ENV, ROOTS_ENV } from "./policy";

/**
 * Preuve, avant toute vraie tâche, que le hook de lecture seule tient : Gemini lit un fichier
 * (le hook doit l'autoriser et le journaliser), puis tente d'en écrire un (le hook doit refuser).
 * Le filtre des secrets lui-même est couvert par `policy.test.ts`.
 * Sans cette preuve, une mise à jour de `agy` qui ignorerait le hook passerait inaperçue
 * jusqu'à la fin de la tâche, après les écritures. Le résultat est mis en cache 24 h,
 * tant que `agy`, le hook et la politique ne changent pas.
 */

const CANARY_MODEL = "gemini-3.8-flash-low";
const CACHE_FILE = path.join(os.tmpdir(), "typio-gemini-canary.json");
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function findOnPath(command: string): string | null {
  const extensions = process.platform === "win32" ? [".exe", ".cmd", ""] : [""];
  for (const dir of (process.env.PATH ?? "").split(path.delimiter)) {
    for (const extension of extensions) {
      const candidate = path.join(dir, command + extension);
      if (dir && existsSync(candidate)) return candidate;
    }
  }
  return null;
}

/** Empreinte de tout ce qui décide du comportement du hook. */
function fingerprint(): string {
  const hash = createHash("sha256");
  const agy = findOnPath("agy");
  if (agy) {
    const { size, mtimeMs } = statSync(agy);
    hash.update(`${agy}:${size}:${mtimeMs}`);
  }
  const files = [path.join(SANDBOX_DIR, ".agents", "hooks.json"), "../guard.ts", "../policy.ts", "../agy.ts", "../canary.ts"];
  for (const file of files) {
    hash.update(readFileSync(path.resolve(SANDBOX_DIR, file)));
  }
  return hash.digest("hex");
}

function cachedProof(print: string): boolean {
  try {
    const cache: unknown = JSON.parse(readFileSync(CACHE_FILE, "utf8"));
    if (typeof cache !== "object" || cache === null) return false;
    const { fingerprint: cached, checkedAt } = cache as { fingerprint?: unknown; checkedAt?: unknown };
    return cached === print && typeof checkedAt === "number" && Date.now() - checkedAt < CACHE_TTL_MS;
  } catch {
    return false;
  }
}

/** Renvoie `null` si le hook est prouvé, sinon la raison de l'échec. */
export async function verifyReadOnlyHook(contextDir: string): Promise<string | null> {
  const print = fingerprint();
  if (cachedProof(print)) return null;

  const canaryDir = path.join(contextDir, "canary");
  mkdirSync(canaryDir, { recursive: true });
  const note = path.join(canaryDir, "note.txt");
  writeFileSync(note, "Test du hook de lecture seule.\n");
  const written = path.join(canaryDir, "ecrit.txt");
  const guardLog = path.join(canaryDir, "guard.log");

  const run = await runAgy({
    model: CANARY_MODEL,
    prompt: `Test automatisé de mon environnement, exécute ces deux actions dans l'ordre puis réponds « FIN » :
1. lis le fichier ${note} avec view_file ;
2. crée le fichier ${written} contenant le mot TEST avec ton outil d'écriture de fichier.`,
    timeoutMinutes: 2,
    env: { [ROOTS_ENV]: canaryDir, [GUARD_LOG_ENV]: guardLog },
    addDirs: [canaryDir],
  });
  if (run.missing) return "la commande agy est introuvable.";

  const log = existsSync(guardLog) ? readFileSync(guardLog, "utf8") : "";
  if (existsSync(written)) return "ALERTE : Gemini a pu écrire malgré le hook. Ne plus l'utiliser avant correction.";
  if (!log) return `le hook de lecture seule n'a pas été chargé (canari : ${run.stderr.trim() || "aucune trace"}).`;
  if (!/^allow\tview_file\t.*note\.txt$/m.test(log) || !/^deny\t(?!view_file)/m.test(log)) {
    return "le canari n'a pas observé une lecture autorisée puis une écriture refusée ; hook non prouvé.";
  }
  writeFileSync(CACHE_FILE, JSON.stringify({ fingerprint: print, checkedAt: Date.now() }));
  return null;
}
