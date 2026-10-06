import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Lancement non interactif de la CLI Antigravity (`agy -p`) et lecture de sa sortie JSON. */

// Dossier de travail de `agy` : il y trouve le hook de lecture seule (`.agents/hooks.json`).
export const SANDBOX_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "sandbox");

// Bun charge `.env.local` dans `process.env` : on ne transmet à `agy` que le nécessaire,
// jamais `DATABASE_URL` ni les secrets OAuth.
const INHERITED_ENV = [
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
];

function safeEnv(extra: Record<string, string>): NodeJS.ProcessEnv {
  // `NODE_ENV` est requis par le type que Next ajoute à `ProcessEnv`, et n'a rien de secret.
  const env: NodeJS.ProcessEnv = { NODE_ENV: process.env.NODE_ENV };
  for (const [key, value] of Object.entries(process.env)) {
    // Windows ignore la casse des noms de variables (`Path` comme `PATH`).
    if (value !== undefined && INHERITED_ENV.some((name) => name.toLowerCase() === key.toLowerCase())) {
      env[key] = value;
    }
  }
  return { ...env, ...extra };
}

export type AgyResult = {
  status?: string;
  response?: string;
  duration_seconds?: number;
  usage?: { total_tokens?: number };
};

export function parseAgyOutput(stdout: string): AgyResult | null {
  // `agy` peut écrire des avertissements avant la ligne JSON finale.
  const line = stdout.trim().split(/\r?\n/).findLast((candidate) => candidate.startsWith("{"));
  if (!line) return null;
  try {
    const parsed: unknown = JSON.parse(line);
    return typeof parsed === "object" && parsed !== null ? (parsed as AgyResult) : null;
  } catch {
    return null;
  }
}

export type AgyRun = { stdout: string; stderr: string; exitCode: number | null; timedOut: boolean; missing: boolean };

export type AgyOptions = {
  model: string;
  prompt: string;
  timeoutMinutes: number;
  env: Record<string, string>;
  addDirs: readonly string[];
};

export function runAgy({ model, prompt, timeoutMinutes, env, addDirs }: AgyOptions): Promise<AgyRun> {
  const args = ["-p", prompt, "--model", model, "--output-format", "json", "--print-timeout", `${timeoutMinutes}m`];
  for (const dir of addDirs) args.push("--add-dir", dir);

  return new Promise<AgyRun>((resolve) => {
    const child = spawn("agy", args, { cwd: SANDBOX_DIR, env: safeEnv(env), windowsHide: true });
    let stdout = "";
    let stderr = "";
    let killed = false;
    let settled = false;
    // Décodage par flux : un caractère accentué peut être coupé entre deux morceaux.
    child.stdout.setEncoding("utf8").on("data", (chunk: string) => (stdout += chunk));
    child.stderr.setEncoding("utf8").on("data", (chunk: string) => (stderr += chunk));
    const finish = (run: Omit<AgyRun, "timedOut">) => {
      if (settled) return;
      settled = true;
      clearTimeout(killer);
      // `agy` rend SUCCESS avec une réponse vide quand son propre délai expire.
      resolve({ ...run, timedOut: killed || /print timeout/i.test(run.stderr) });
    };
    // Filet si `agy` ne respecte pas son propre délai : on tue tout l'arbre de processus,
    // sinon un enfant qui garde les tubes ouverts empêcherait `close`.
    const killer = setTimeout(
      () => {
        killed = true;
        if (process.platform === "win32" && child.pid !== undefined) {
          spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
        } else {
          child.kill("SIGKILL");
        }
        finish({ stdout, stderr, exitCode: null, missing: false });
      },
      (timeoutMinutes + 1) * 60_000,
    );
    child.on("error", (error: NodeJS.ErrnoException) => {
      finish({ stdout, stderr: error.message, exitCode: null, missing: error.code === "ENOENT" });
    });
    child.on("close", (exitCode) => finish({ stdout, stderr, exitCode, missing: false }));
  });
}
