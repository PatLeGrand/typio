import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { UnavailableError, UsageError } from "./errors";

/**
 * Lancement non interactif de la CLI Codex (`codex exec`) : arguments, environnement,
 * résolution du binaire et lecture des événements JSONL. Les parties pures sont testées
 * dans `codex.test.ts`.
 */

export const EFFORTS = ["low", "medium", "high", "xhigh", "max"] as const;
export type Effort = (typeof EFFORTS)[number];

/** Lit `--effort` : un effort inconnu est une erreur d'usage, pas un Codex indisponible. */
export function parseEffort(value: string): Effort {
  const effort = EFFORTS.find((candidate) => candidate === value);
  if (!effort) throw new UsageError(`Effort inconnu : ${value} (attendu : ${EFFORTS.join(", ")}).`);
  return effort;
}

export type SandboxMode = "read-only" | "workspace-write" | "danger-full-access";

// Bun charge `.env.local` dans `process.env` : on ne transmet à Codex que le nécessaire,
// jamais `DATABASE_URL` ni les secrets OAuth (sauf base locale hors du bac à sable, voir `safeEnv`). `CODEX_HOME` est transmis s'il est défini
// (autre emplacement de la config et de l'authentification) ; sinon Codex utilise `~/.codex`
// via `USERPROFILE`.
export const INHERITED_ENV = [
  "PATH",
  "PATHEXT",
  "SystemRoot",
  "SystemDrive",
  "windir",
  "ComSpec",
  "USERPROFILE",
  "USERNAME",
  "HOME",
  "HOMEDRIVE",
  "HOMEPATH",
  "APPDATA",
  "LOCALAPPDATA",
  "ProgramData",
  "ProgramFiles",
  "ProgramFiles(x86)",
  "TEMP",
  "TMP",
  "TMPDIR",
  "LANG",
  "CODEX_HOME",
];

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * Vrai si l'URL de base de données vise la machine locale. Un paramètre `host` ou `hostaddr`
 * (pilote postgres) pourrait rediriger la connexion ailleurs : il invalide l'URL.
 */
export function isLocalDatabaseUrl(value: string | undefined): boolean {
  if (!value) return false;
  // `#` (fragment), `%` (encodage) et `\` (séparateur pour WHATWG, pas pour le pilote) font lire
  // l'URL autrement par `new URL` et par le pilote : on les refuse, sans chercher à les interpréter.
  if (/[#%\\]/.test(value)) return false;
  // Le pilote lit une liste d'hôtes (`a,b`) et prend le dernier `@` : `new URL` en voit un seul.
  // L'autorité (entre `://` et le premier `/`, `?` ou `#`) ne doit donc ni contenir `,` ni plus d'un `@`.
  const authority = /^[A-Za-z][A-Za-z0-9+.-]*:\/\/([^/?#]*)/.exec(value)?.[1];
  if (authority === undefined || authority.includes(",") || authority.split("@").length > 2) return false;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return LOCAL_HOSTS.has(url.hostname.toLowerCase()) && !url.searchParams.has("host") && !url.searchParams.has("hostaddr");
}

export type SafeEnvOptions = {
  /** `DATABASE_URL` passe, mais seulement si elle vise la machine locale. Jamais une autre URL de base. */
  localDatabase?: boolean;
};

export function safeEnv(source: NodeJS.ProcessEnv = process.env, { localDatabase = false }: SafeEnvOptions = {}): NodeJS.ProcessEnv {
  // `NODE_ENV` est requis par le type que Next ajoute à `ProcessEnv`, et n'a rien de secret.
  const env: NodeJS.ProcessEnv = { NODE_ENV: source.NODE_ENV };
  for (const [key, value] of Object.entries(source)) {
    if (value === undefined) continue;
    // Windows ignore la casse des noms de variables (`Path` comme `PATH`).
    const name = key.toLowerCase();
    const isLocalDatabase = localDatabase && name === "database_url" && isLocalDatabaseUrl(value);
    if (isLocalDatabase || INHERITED_ENV.some((inherited) => inherited.toLowerCase() === name)) env[key] = value;
  }
  return env;
}

/**
 * Environnement des vérifications du wrapper (lint, tests, build) : l'allowlist de `safeEnv`
 * (dont `NODE_ENV`) plus `DATABASE_URL` si elle vise la machine locale. Ces commandes exécutent du
 * code écrit par Codex : jamais les `AUTH_*` ni le reste du `.env.local`. Si une vérification
 * échoue faute d'une variable, on rapporte l'échec tel quel.
 */
export function checkEnv(source: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  return safeEnv(source, { localDatabase: true });
}

export type CodexArgsOptions = {
  /** Dossier de travail de Codex : la copie expurgée, jamais le vrai dépôt. */
  cwd: string;
  /** Fichier où Codex écrit son dernier message. */
  lastMessageFile: string;
  effort: Effort;
  /**
   * Toujours imposé : sans `-m` et avec `--ignore-user-config`, Codex prend son modèle par défaut
   * avec un effort `none`, ce qui n'est le choix de personne.
   */
  model: string;
  /** Lecture seule par défaut ; l'écriture est un choix explicite de l'appelant. */
  sandbox?: SandboxMode;
};

/**
 * Arguments de `codex exec`, identiques pour le canari et pour les vraies tâches.
 * `--ignore-user-config` est obligatoire : la config de l'utilisateur active des plugins
 * (computer-use, navigateur, MCP) que le bac à sable en lecture seule ne couvre pas.
 * L'authentification est conservée malgré ce flag. Le prompt arrive sur stdin (`-`).
 */
export function buildCodexArgs({ cwd, lastMessageFile, effort, model, sandbox = "read-only" }: CodexArgsOptions): string[] {
  return [
    "exec",
    "--ignore-user-config",
    // Une clé `-c` mal tapée fait échouer Codex au lieu d'être ignorée (vérifié : `-c a.b=1` inconnu
    // est refusé, `sandbox_workspace_write.network_access` et `windows.sandbox` sont acceptés).
    "--strict-config",
    "--ephemeral",
    "--skip-git-repo-check",
    "-s",
    sandbox,
    "-c",
    'approval_policy="never"',
    "-c",
    'windows.sandbox="unelevated"',
    // Réseau coupé en écriture, explicitement : c'est le défaut de Codex, mais ce code le dit.
    // Aucune clé réseau n'existe pour `read-only` (`--strict-config` la refuse), où il n'y a pas
    // de réseau par définition. Le canari ne prouve que l'écriture, pas l'absence de réseau.
    ...(sandbox === "workspace-write" ? ["-c", "sandbox_workspace_write.network_access=false"] : []),
    "-m",
    model,
    "-c",
    `model_reasoning_effort="${effort}"`,
    "-C",
    cwd,
    "--color",
    "never",
    "--json",
    "-o",
    lastMessageFile,
    "-",
  ];
}

export type BinaryLookup = {
  env: NodeJS.ProcessEnv;
  platform: NodeJS.Platform;
  exists: (file: string) => boolean;
  /** `codex.exe` de l'app desktop, avec leur date de modification. */
  desktopCandidates: (localAppData: string) => { file: string; mtimeMs: number }[];
};

function envValue(env: NodeJS.ProcessEnv, name: string): string | undefined {
  const key = Object.keys(env).find((candidate) => candidate.toLowerCase() === name.toLowerCase());
  return key === undefined ? undefined : env[key];
}

function listDesktopCandidates(localAppData: string): { file: string; mtimeMs: number }[] {
  const binDir = path.join(localAppData, "OpenAI", "Codex", "bin");
  if (!existsSync(binDir)) return [];
  const found: { file: string; mtimeMs: number }[] = [];
  for (const entry of readdirSync(binDir, { withFileTypes: true })) {
    const file = path.join(binDir, entry.name, "codex.exe");
    if (entry.isDirectory() && existsSync(file)) found.push({ file, mtimeMs: statSync(file).mtimeMs });
  }
  return found;
}

const REAL_LOOKUP: BinaryLookup = {
  env: process.env,
  platform: process.platform,
  exists: existsSync,
  desktopCandidates: listDesktopCandidates,
};

/**
 * Cherche le binaire Codex : `CODEX_BIN` (seul, sans repli : un chemin faux doit se voir),
 * puis `codex` dans le PATH, puis le `codex.exe` le plus récent de l'app desktop.
 * Renvoie `null` s'il est introuvable.
 */
export function resolveCodexBinary(lookup: BinaryLookup = REAL_LOOKUP): string | null {
  const explicit = envValue(lookup.env, "CODEX_BIN");
  if (explicit) return lookup.exists(explicit) ? explicit : null;

  // Seul un exécutable direct est lançable : un shim `.cmd` demanderait un shell.
  const extensions = lookup.platform === "win32" ? [".exe"] : [""];
  for (const dir of (envValue(lookup.env, "PATH") ?? "").split(path.delimiter)) {
    for (const extension of extensions) {
      const candidate = path.join(dir, `codex${extension}`);
      if (dir && lookup.exists(candidate)) return candidate;
    }
  }

  const localAppData = envValue(lookup.env, "LOCALAPPDATA");
  if (localAppData) {
    const newest = lookup.desktopCandidates(localAppData).sort((a, b) => b.mtimeMs - a.mtimeMs)[0];
    if (newest) return newest.file;
  }
  return null;
}

export type CodexEvents = {
  /** Jetons cumulés de tous les tours terminés, si Codex les a rapportés. */
  usage: { input: number; output: number } | null;
  /** Messages d'erreur rapportés par Codex (quota, modèle refusé…). */
  errors: string[];
  /** Commandes lancées par Codex, avec leur code de sortie (`null` tant qu'elles tournent). */
  commands: { command: string; exitCode: number | null; output: string }[];
};

export function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

/**
 * Lit les événements JSONL de `--json`. Le format n'est pas un contrat stable : tout ce qui
 * n'a pas la forme attendue est ignoré, sans jamais empêcher d'utiliser la réponse.
 */
export function parseCodexEvents(stdout: string): CodexEvents {
  const result: CodexEvents = { usage: null, errors: [], commands: [] };
  for (const line of stdout.split(/\r?\n/)) {
    if (!line.startsWith("{")) continue;
    let event: Record<string, unknown> | null;
    try {
      event = asRecord(JSON.parse(line));
    } catch {
      continue;
    }
    if (!event) continue;
    if (event.type === "turn.completed") {
      const usage = asRecord(event.usage);
      if (usage && typeof usage.input_tokens === "number" && typeof usage.output_tokens === "number") {
        result.usage = {
          input: (result.usage?.input ?? 0) + usage.input_tokens,
          output: (result.usage?.output ?? 0) + usage.output_tokens,
        };
      }
    } else if (event.type === "error" && typeof event.message === "string") {
      result.errors.push(event.message);
    } else if (event.type === "turn.failed") {
      const message = asRecord(event.error)?.message;
      if (typeof message === "string") result.errors.push(message);
    } else if (event.type === "item.completed") {
      const item = asRecord(event.item);
      if (item?.type === "command_execution" && typeof item.command === "string") {
        result.commands.push({
          command: item.command,
          exitCode: typeof item.exit_code === "number" ? item.exit_code : null,
          output: typeof item.aggregated_output === "string" ? item.aggregated_output : "",
        });
      }
    }
  }
  return result;
}

const WRITE_COMMAND = /Set-Content|Add-Content|Out-File|New-Item|Tee-Object|Copy-Item|WriteAll|>/i;
const DENIAL = /denied|refus|PermissionDenied|Unauthorized/i;

/**
 * Vrai si Codex a tenté d'écrire `fileName` et que le système a refusé : une commande
 * d'écriture en échec, dont la sortie parle d'un refus. Une commande qui échoue pour une
 * autre raison (fichier absent à la lecture, par exemple) ne prouve rien.
 */
export function hasDeniedWrite(commands: CodexEvents["commands"], fileName: string): boolean {
  return commands.some(
    ({ command, exitCode, output }) =>
      exitCode !== 0 && command.includes(fileName) && WRITE_COMMAND.test(command) && DENIAL.test(output),
  );
}

/**
 * Arrête le processus et tout son arbre : un enfant qui garde les tubes ouverts bloquerait `close`.
 * Rien si le processus est déjà terminé : son PID peut avoir été réattribué à un autre programme.
 */
export function killTree(child: ChildProcess): void {
  if (child.pid === undefined || child.exitCode !== null || child.signalCode !== null) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    return;
  }
  try {
    process.kill(-child.pid, "SIGKILL");
  } catch {
    child.kill("SIGKILL");
  }
}

export type CodexRun = { stdout: string; stderr: string; exitCode: number | null; timedOut: boolean; missing: boolean };

export type RunOptions = {
  bin: string;
  args: readonly string[];
  prompt: string;
  timeoutMinutes: number;
  env: NodeJS.ProcessEnv;
};

// Après l'arrêt de l'arbre de processus, laisse une minute aux tubes pour se fermer.
const GRACE_MS = 60_000;

// Les Codex en cours : un Ctrl+C du wrapper doit les arrêter, sinon ils continueraient à écrire.
const activeChildren = new Set<ChildProcess>();

export function killActiveChildren(): void {
  for (const child of activeChildren) killTree(child);
}

/** Arrête la tâche si un signal a interrompu Codex : le flux d'erreur normal nettoie ensuite. */
export function throwIfInterrupted(signal: NodeJS.Signals | null): void {
  if (signal) throw new UnavailableError(`interrompu (${signal})`);
}

export type InterruptWatch = {
  /** Nom du signal reçu, ou `null`. */
  signal(): NodeJS.Signals | null;
  dispose(): void;
};

/**
 * Sur SIGINT ou SIGTERM : arrête les Codex en cours. Le flux normal reprend ensuite (la tâche
 * échoue, le worktree est gardé s'il a changé, les dossiers temporaires sont nettoyés).
 */
export function watchInterrupts(): InterruptWatch {
  let received: NodeJS.Signals | null = null;
  const handlers = (["SIGINT", "SIGTERM"] as const).map((name) => {
    const handler = () => {
      received = name;
      killActiveChildren();
    };
    process.on(name, handler);
    return [name, handler] as const;
  });
  return {
    signal: () => received,
    dispose: () => handlers.forEach(([name, handler]) => process.off(name, handler)),
  };
}

export function runCodex({ bin, args, prompt, timeoutMinutes, env }: RunOptions): Promise<CodexRun> {
  return new Promise<CodexRun>((resolve) => {
    // Hors Windows, Codex devient chef de son groupe de processus : le délai peut tuer le groupe entier.
    const child = spawn(bin, [...args], { env, windowsHide: true, detached: process.platform !== "win32" });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;
    let grace: NodeJS.Timeout | undefined;
    // Décodage par flux : un caractère accentué peut être coupé entre deux morceaux.
    child.stdout.setEncoding("utf8").on("data", (chunk: string) => (stdout += chunk));
    child.stderr.setEncoding("utf8").on("data", (chunk: string) => (stderr += chunk));
    activeChildren.add(child);
    const finish = (run: Omit<CodexRun, "timedOut">) => {
      if (settled) return;
      settled = true;
      activeChildren.delete(child);
      clearTimeout(killer);
      clearTimeout(grace);
      resolve({ ...run, timedOut });
    };
    // Codex n'a pas de délai propre : à l'échéance on tue tout l'arbre de processus, sinon un
    // enfant qui garde les tubes ouverts empêcherait `close`. Filet : délai + 1 min.
    const killer = setTimeout(() => {
      timedOut = true;
      killTree(child);
      grace = setTimeout(() => finish({ stdout, stderr, exitCode: null, missing: false }), GRACE_MS);
    }, timeoutMinutes * 60_000);
    child.on("error", (error: NodeJS.ErrnoException) => {
      finish({ stdout, stderr: error.message, exitCode: null, missing: error.code === "ENOENT" });
    });
    child.on("close", (exitCode) => finish({ stdout, stderr, exitCode, missing: false }));
    // Un EPIPE sur stdin (Codex mort avant d'avoir lu) ne doit pas faire planter `run.ts`.
    child.stdin.on("error", () => {});
    child.stdin.end(prompt);
  });
}

/**
 * Codex rapporte parfois l'erreur de l'API telle quelle, en JSON (`{"error":{"message":…}}`) :
 * on en tire le message, sinon on garde le texte.
 */
function readableError(message: string): string {
  if (!message.startsWith("{")) return message;
  try {
    const parsed = asRecord(JSON.parse(message));
    const inner = asRecord(parsed?.error)?.message ?? parsed?.message;
    return typeof inner === "string" ? inner : message;
  } catch {
    return message;
  }
}

/** Raison de l'échec d'une exécution, pour le message `CODEX_INDISPONIBLE`. */
export function describeFailure(run: CodexRun, events: CodexEvents, response: string): string {
  const raw = events.errors.at(-1) ?? (run.stderr.trim() || `code ${run.exitCode}`);
  const detail = readableError(raw).split("\n").slice(-3).join(" ");
  const status = run.timedOut ? "délai dépassé" : response === "" ? "réponse vide" : "échec";
  return `${status}, ${detail}`;
}
