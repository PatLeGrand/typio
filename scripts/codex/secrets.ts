import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { listTree } from "./collect";
import { TamperedWorkError } from "./errors";
import { git } from "./snapshot";

/**
 * Contenu secret : avant le report, les fichiers ajoutés ou modifiés par Codex sont comparés aux valeurs
 * du `.env.local` du dépôt principal et aux chaînes de `~/.codex/auth.json`. Codex lit le disque entier :
 * rien ne l'empêche de recopier une valeur dans un fichier du diff. Une correspondance est une ALERTE ;
 * le message donne le chemin du fichier et la source, jamais la valeur.
 */

export type SecretSource = {
  /** Nom montré dans l'ALERTE. */
  label: ".env.local" | "auth.json";
  values: readonly string[];
};

// 16 caractères : assez pour les vrais secrets (OAuth, AUTH_SECRET, URL de base), sans alerter sur `localhost` ou `development`.
const MIN_ENV_LENGTH = 16;
const MIN_AUTH_LENGTH = 20;

/** Valeurs d'un fichier `.env` : après le premier `=`, guillemets retirés, au moins 16 caractères. */
export function parseEnvValues(content: string): string[] {
  const values: string[] = [];
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) continue;
    const equals = line.indexOf("=");
    if (equals < 0) continue;
    let value = line.slice(equals + 1).trim();
    if (value.length >= 2 && (value[0] === '"' || value[0] === "'") && value.endsWith(value[0] ?? "")) value = value.slice(1, -1);
    if (value.length >= MIN_ENV_LENGTH) values.push(value);
  }
  return [...new Set(values)];
}

/** Chaînes d'au moins 20 caractères d'un JSON, à toute profondeur (clés d'API, jetons). */
export function collectJsonStrings(json: unknown, minLength: number = MIN_AUTH_LENGTH): string[] {
  const found = new Set<string>();
  const visit = (node: unknown): void => {
    if (typeof node === "string") {
      if (node.length >= minLength) found.add(node);
    } else if (Array.isArray(node)) {
      node.forEach(visit);
    } else if (typeof node === "object" && node !== null) {
      Object.values(node).forEach(visit);
    }
  };
  visit(json);
  return [...found];
}

/** Racine du dépôt principal : parent du dossier git commun à tous les worktrees. */
export function mainRepoRoot(cwd: string): string {
  const common = git(cwd, ["rev-parse", "--path-format=absolute", "--git-common-dir"]).trim();
  return path.resolve(path.dirname(common));
}

function readSource(file: string, label: SecretSource["label"], extract: (content: string) => string[]): SecretSource | null {
  if (!existsSync(file)) {
    console.error(`AVERTISSEMENT : ${label} introuvable, sa comparaison avec le travail de Codex est sautée.`);
    return null;
  }
  try {
    return { label, values: extract(readFileSync(file, "utf8")) };
  } catch {
    // Pas de `error.message` : sous Node, une erreur de JSON.parse en cite un extrait, donc de la valeur.
    console.error(`AVERTISSEMENT : ${label} illisible, ignoré (sa comparaison avec le travail de Codex est sautée).`);
    return null;
  }
}

/** Sources réelles : `.env.local` du dépôt principal et `~/.codex/auth.json`, lus seulement pour cette comparaison. */
export function defaultSecretSources(
  cwd: string,
  authFile: string = path.join(os.homedir(), ".codex", "auth.json"),
): SecretSource[] {
  let envFile: string;
  try {
    envFile = path.join(mainRepoRoot(cwd), ".env.local");
  } catch (error) {
    console.error(`AVERTISSEMENT : racine du dépôt principal introuvable (${error instanceof Error ? error.message : String(error)}), .env.local n'est pas comparé.`);
    envFile = "";
  }
  return [
    ...(envFile === "" ? [] : [readSource(envFile, ".env.local", parseEnvValues)]),
    readSource(authFile, "auth.json", (content) => collectJsonStrings(JSON.parse(content) as unknown)),
  ].filter((source): source is SecretSource => source !== null);
}

/** La valeur, et ses formes base64 (standard et url-safe, avec et sans remplissage). */
export function secretForms(value: string): string[] {
  const buffer = Buffer.from(value, "utf8");
  const standard = buffer.toString("base64");
  const urlSafe = standard.replaceAll("+", "-").replaceAll("/", "_");
  const strip = (text: string): string => text.replace(/=+$/, "");
  return [...new Set([value, standard, strip(standard), urlSafe, strip(urlSafe)])];
}

/**
 * Retire des sources toute valeur dont la forme en clair apparaît dans au moins un fichier de `baseDir`
 * (le commit de départ) : une valeur déjà publique (`APP_ORIGIN`, URL de la base locale…) n'est pas un
 * secret, et la chercher dans le diff donnerait une fausse ALERTE dès que Codex touche un README. Les formes
 * base64 d'une valeur retenue restent cherchées. `base/` est lue une seule fois, fichier par fichier.
 */
export function withoutPublicValues(baseDir: string, sources: readonly SecretSource[]): SecretSource[] {
  const pending = new Map<string, Buffer>();
  for (const source of sources) for (const value of source.values) pending.set(value, Buffer.from(value, "utf8"));
  const isPublic = new Set<string>();
  if (pending.size > 0) {
    for (const entry of listTree(baseDir)) {
      if (entry.kind !== "file") continue;
      const content = readFileSync(entry.full);
      for (const [value, needle] of pending) {
        if (content.includes(needle)) {
          isPublic.add(value);
          pending.delete(value);
        }
      }
      if (pending.size === 0) break;
    }
  }
  return sources.map((source) => ({ ...source, values: source.values.filter((value) => !isPublic.has(value)) }));
}

export type SecretLeak = { file: string; source: SecretSource["label"] };

/** Fichiers de `srcDir` (chemins relatifs) qui contiennent une valeur secrète. Une seule fuite par fichier. */
export function findSecretLeaks(srcDir: string, files: readonly string[], sources: readonly SecretSource[]): SecretLeak[] {
  const needles = sources.map((source) => ({ label: source.label, forms: source.values.flatMap(secretForms).filter((form) => form !== "").map((form) => Buffer.from(form, "utf8")) }));
  const leaks: SecretLeak[] = [];
  for (const file of files) {
    const content = readFileSync(path.join(srcDir, file));
    const hit = needles.find(({ forms }) => forms.some((form) => content.includes(form)));
    if (hit) leaks.push({ file, source: hit.label });
  }
  return leaks;
}

/** ALERTE (`TamperedWorkError`, travail gardé) si un fichier du diff contient une valeur secrète. Jamais la valeur dans le message. */
export function assertNoSecrets(srcDir: string, files: readonly string[], sources: readonly SecretSource[]): void {
  const leaks = findSecretLeaks(srcDir, files, sources);
  if (leaks.length > 0) {
    const list = leaks.map(({ file, source }) => `${file} (valeur de ${source})`).join(", ");
    throw new TamperedWorkError(`ALERTE : le travail de Codex contient une valeur secrète : ${list}. Valeur non affichée ; rien n'a été reporté.`);
  }
}
