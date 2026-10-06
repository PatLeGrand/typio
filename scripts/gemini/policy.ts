import path from "node:path";

/**
 * Politique d'outils imposée à Gemini (`agy`) par le hook `PreToolUse` :
 * lecture seule, limitée aux racines autorisées, sans fichiers de secrets.
 *
 * `--mode plan` de `agy` n'empêche pas l'écriture : seule cette politique la bloque.
 */

export type ToolCall = {
  name?: unknown;
  args?: Record<string, unknown>;
};

export type Decision = { decision: "allow" } | { decision: "deny"; reason: string };

/** Variable d'environnement listant les racines lisibles, séparées par `path.delimiter`. */
export const ROOTS_ENV = "TYPIO_GEMINI_ROOTS";

/** Journal des décisions du hook : sa présence prouve à `run.ts` que le hook a été chargé. */
export const GUARD_LOG_ENV = "TYPIO_GEMINI_GUARD_LOG";

// `.env.example` est versionné et ne contient pas de secret.
const SECRET_FILE = /^(\.env(\..+)?|.+\.(pem|key|p12|pfx)|id_(rsa|ed25519|ecdsa)(\.pub)?)$/i;
const ALLOWED_SECRET_LOOKALIKE = /^\.env\.example$/i;

// Arguments descriptifs de `view_file`, observés dans les appels réels de `agy`.
const DESCRIPTIVE_ARGS = new Set(["AbsolutePath", "toolAction", "toolSummary"]);

function deny(reason: string): Decision {
  return { decision: "deny", reason };
}

function isInside(root: string, target: string, pathApi: path.PlatformPath): boolean {
  const relative = pathApi.relative(root, target);
  return relative === "" || (!relative.startsWith("..") && !pathApi.isAbsolute(relative));
}

/**
 * Décide si un appel d'outil est autorisé. `resolvedPath` est le chemin réel du fichier
 * demandé (`realpathSync.native` : liens, noms courts et casse résolus), ou `null` si
 * la résolution a échoué.
 */
export function decideToolCall(
  call: ToolCall,
  roots: readonly string[],
  resolvedPath: string | null,
  pathApi: path.PlatformPath = path,
): Decision {
  if (call.name !== "view_file") {
    return deny("Lecture seule : seul view_file est autorisé.");
  }
  if (roots.length === 0 || resolvedPath === null) {
    return deny("Chemin ou racines autorisées manquants.");
  }
  // Seul `AbsolutePath` est contrôlé : un autre argument portant un chemin échapperait à la politique.
  const smuggledPath = Object.entries(call.args ?? {}).some(
    // Sérialisé : un chemin caché dans un tableau ou un objet compte aussi.
    ([key, value]) => !DESCRIPTIVE_ARGS.has(key) && /[\\/]/.test(JSON.stringify(value) ?? ""),
  );
  if (smuggledPath) {
    return deny("Argument de chemin inattendu.");
  }
  // Noms courts 8.3 (`ENV~1.LOC`), flux NTFS (`.env::$DATA`) et points ou espaces finaux
  // désignent un autre nom que celui affiché : le filtre des secrets serait contourné.
  const afterDrive = pathApi === path.win32 ? resolvedPath.replace(/^[a-z]:/i, "") : resolvedPath;
  if (afterDrive.includes(":") || resolvedPath.split(/[\\/]/).some((segment) => /~\d|[. ]$/.test(segment))) {
    return deny("Forme de chemin ambiguë.");
  }

  // Windows ignore la casse des chemins : on compare en minuscules.
  const normalize = (value: string) =>
    pathApi === path.win32 ? pathApi.resolve(value).toLowerCase() : pathApi.resolve(value);
  const target = normalize(resolvedPath);

  if (!roots.some((root) => isInside(normalize(root), target, pathApi))) {
    return deny("Fichier hors des dossiers autorisés.");
  }

  const segments = target.split(pathApi.sep);
  if (segments.includes(".git")) {
    return deny("Le dossier .git n'est pas lisible.");
  }
  const fileName = pathApi.basename(target);
  if (SECRET_FILE.test(fileName) && !ALLOWED_SECRET_LOOKALIKE.test(fileName)) {
    return deny("Fichier de secrets non lisible.");
  }
  return { decision: "allow" };
}
