import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";
import { parseAgyOutput, runAgy } from "./agy";
import { verifyReadOnlyHook } from "./canary";
import { GUARD_LOG_ENV, ROOTS_ENV } from "./policy";
import { captureScreenshots } from "./screenshots";
import { buildPrompt, TASKS, type TaskName } from "./tasks";

/**
 * Délègue une tâche en lecture seule à Gemini via la CLI Antigravity (`agy`).
 *
 *   bun scripts/gemini/run.ts <search|review|tests|ui|visual> [options] "<consigne>"
 *
 * Codes de sortie :
 *   0  réponse de Gemini sur stdout ;
 *   1  mauvaise utilisation (tâche inconnue, option invalide, aucun changement à relire…) ;
 *   2  Gemini indisponible (quota, erreur, délai, réponse vide, hook non prouvé) : continuer sans lui.
 */

const USAGE = `Usage : bun scripts/gemini/run.ts <tâche> [options] "<consigne>"
Tâches : ${Object.keys(TASKS).join(", ")}
Options :
  --base <ref>     base du diff (review, tests, ui) ; défaut : origin/develop
  --url <url>      page à capturer (visual), répétable
  --image <path>   image de référence PNG, JPEG ou WebP (visual), répétable
  --model <id>     impose un modèle (voir \`agy models\`)
  --keep           conserve le dossier de contexte`;

class UsageError extends Error {}
class UnavailableError extends Error {}

// Seules des images peuvent servir de référence : `--image .env.local` ne doit pas copier
// un secret sous un nom qui échapperait au filtre du hook.
const REFERENCE_IMAGE = /\.(png|jpe?g|webp)$/i;

function git(root: string, args: string[]): string {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0) {
    throw new UsageError(`git ${args.join(" ")} : ${result.stderr?.trim() || result.error?.message}`);
  }
  return result.stdout;
}

function listNextDocs(root: string): string[] {
  const docsDir = path.join(root, "node_modules", "next", "dist", "docs");
  if (!existsSync(docsDir)) return [];
  return readdirSync(docsDir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.relative(root, path.join(entry.parentPath, entry.name)).replaceAll("\\", "/"));
}

function resolveBase(root: string, base: string | undefined): string {
  if (base) return base;
  const hasRemote = spawnSync("git", ["rev-parse", "--verify", "--quiet", "origin/develop"], { cwd: root });
  return hasRemote.status === 0 ? "origin/develop" : "develop";
}

function buildFilesContext(root: string): string {
  const files = git(root, ["ls-files", "--cached", "--others", "--exclude-standard"]).trim();
  const docs = listNextDocs(root);
  return `# Fichiers du dépôt\n\n${files}\n\n# Documentation Next.js installée\n\n${docs.join("\n") || "(absente)"}\n`;
}

function buildDiffContext(root: string, baseRef: string | undefined): string {
  const base = resolveBase(root, baseRef);
  const mergeBase = git(root, ["merge-base", base, "HEAD"]).trim();
  // Diff jusqu'à l'arbre de travail : les changements non commités comptent aussi.
  const diff = git(root, ["diff", mergeBase, "--", ".", ":(exclude)bun.lock"]);
  const untracked = git(root, ["ls-files", "--others", "--exclude-standard"]).trim();
  if (diff.trim() === "" && untracked === "") {
    throw new UsageError(`Aucun changement par rapport à ${base}.`);
  }
  const log = git(root, ["log", "--oneline", `${mergeBase}..HEAD`]).trim();
  return `# Changement à examiner (base : ${base})

## Commits
${log || "(aucun commit, changements non commités seulement)"}

## Nouveaux fichiers non suivis (à ouvrir avec view_file)
${untracked || "(aucun)"}

## Diff
\`\`\`diff
${diff}
\`\`\`
`;
}

async function buildScreenshotsContext(contextDir: string, urls: string[], images: string[]): Promise<string> {
  if (urls.length === 0 && images.length === 0) {
    throw new UsageError("La tâche visual demande au moins une --url ou une --image.");
  }
  for (const url of urls) {
    if (!URL.canParse(url)) throw new UsageError(`URL invalide : ${url}`);
  }
  const realImages = images.map((image) => {
    if (!existsSync(image)) throw new UsageError(`Image introuvable : ${image}`);
    const real = realpathSync.native(image);
    if (!REFERENCE_IMAGE.test(real)) throw new UsageError(`Pas une image PNG, JPEG ou WebP : ${image}`);
    return real;
  });
  const shots = await captureScreenshots(urls, contextDir);
  const references = realImages.map((image, index) => {
    // L'index évite d'écraser deux références de même nom venant de dossiers différents.
    const copy = path.join(contextDir, `reference-${index + 1}-${path.basename(image)}`);
    copyFileSync(image, copy);
    return copy;
  });
  return `# Captures à examiner\n\n${shots.join("\n") || "(aucune)"}\n\n# Images de référence\n\n${
    references.join("\n") || "(aucune)"
  }\n`;
}

function summarizeGuardLog(logFile: string): { reads: number; denied: string[] } {
  const lines = readFileSync(logFile, "utf8").trim().split("\n").filter(Boolean);
  const denied = lines.filter((line) => line.startsWith("deny")).map((line) => line.split("\t").slice(1).join(" "));
  return { reads: lines.length - denied.length, denied };
}

function parseCommandLine() {
  try {
    return parseArgs({
      allowPositionals: true,
      options: {
        base: { type: "string" },
        url: { type: "string", multiple: true, default: [] },
        image: { type: "string", multiple: true, default: [] },
        model: { type: "string" },
        keep: { type: "boolean", default: false },
      },
    });
  } catch (error) {
    // Une option mal tapée ne doit pas passer pour un Gemini indisponible.
    throw new UsageError(`${error instanceof Error ? error.message : String(error)}\n\n${USAGE}`);
  }
}

async function main(): Promise<number> {
  const { values, positionals } = parseCommandLine();
  const [taskName, ...instructionParts] = positionals;
  if (!taskName || !(taskName in TASKS)) throw new UsageError(USAGE);
  const task = TASKS[taskName as TaskName];
  const instruction = instructionParts.join(" ").trim();
  if (task.requiresInstruction && !instruction) throw new UsageError(`La tâche ${taskName} demande une consigne.`);

  // Chemins réels, comme ceux que le hook compare (jonctions, dossiers temporaires liés).
  const root = realpathSync.native(git(process.cwd(), ["rev-parse", "--show-toplevel"]).trim());
  const contextDir = realpathSync.native(mkdtempSync(path.join(os.tmpdir(), "typio-gemini-")));
  // Les captures restent après un succès, pour vérifier les constats sur l'image.
  const keepOnSuccess = values.keep || task.context === "screenshots";
  let succeeded = false;
  try {
    const context =
      task.context === "files"
        ? buildFilesContext(root)
        : task.context === "diff"
          ? buildDiffContext(root, values.base)
          : await buildScreenshotsContext(contextDir, values.url, values.image);
    const contextFile = path.join(contextDir, "context.md");
    writeFileSync(contextFile, context);

    const hookProblem = await verifyReadOnlyHook(contextDir);
    if (hookProblem) throw new UnavailableError(hookProblem);

    const prompt = buildPrompt(task, root, contextFile, instruction);
    const models = values.model ? [values.model] : task.models;
    const failures: string[] = [];

    for (const model of models) {
      const guardLog = path.join(contextDir, `guard-${model}.log`);
      const env = { [ROOTS_ENV]: [root, contextDir].join(path.delimiter), [GUARD_LOG_ENV]: guardLog };
      const run = await runAgy({ model, prompt, timeoutMinutes: task.timeoutMinutes, env, addDirs: [root, contextDir] });
      if (run.missing) throw new UnavailableError("la commande agy est introuvable.");
      const result = parseAgyOutput(run.stdout);
      const response = result?.response?.trim() ?? "";

      if (run.exitCode === 0 && result?.status === "SUCCESS" && response !== "") {
        // Gemini lit toujours le contexte : sans journal, le hook n'a pas tourné pendant la tâche.
        if (!existsSync(guardLog)) {
          throw new UnavailableError("le hook de lecture seule n'a pas tourné pendant la tâche ; vérifier `git status`.");
        }
        const { reads, denied } = summarizeGuardLog(guardLog);
        console.log(response);
        console.log(
          `\n---\nGemini ${model} · ${result.usage?.total_tokens ?? "?"} tokens Gemini · ${Math.round(
            result.duration_seconds ?? 0,
          )} s · ${reads} lectures, ${denied.length} refus${denied.length ? ` : ${denied.join(" ; ")}` : ""}`,
        );
        if (keepOnSuccess) console.log(`Contexte conservé : ${contextDir}`);
        succeeded = true;
        return 0;
      }

      const detail = (run.stderr.trim() || run.stdout.trim() || `code ${run.exitCode}`).split("\n").slice(-3).join(" ");
      const status = run.timedOut ? "délai dépassé" : (result?.status ?? "sans réponse JSON");
      failures.push(`${model} : ${status}, ${detail}`);
      // Après un délai dépassé, un second modèle doublerait l'attente : on rend la main.
      if (run.timedOut) break;
    }
    throw new UnavailableError(failures.join(" | "));
  } finally {
    if (values.keep && !succeeded) console.error(`Contexte conservé : ${contextDir}`);
    // Windows peut garder un fichier verrouillé un instant après la fin de `agy`.
    else if (!(keepOnSuccess && succeeded)) rmSync(contextDir, { recursive: true, force: true, maxRetries: 3 });
  }
}

try {
  process.exitCode = await main();
} catch (error) {
  if (error instanceof UnavailableError) {
    console.error(`GEMINI_INDISPONIBLE : ${error.message}`);
    process.exitCode = 2;
  } else if (error instanceof UsageError) {
    console.error(error.message);
    process.exitCode = 1;
  } else {
    // Échec de préparation (capture, git…) : on se rabat aussi sur Claude.
    console.error(`GEMINI_INDISPONIBLE : ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 2;
  }
}
