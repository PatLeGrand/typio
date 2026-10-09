import { spawnSync } from "node:child_process";
import { cpSync, type Dirent, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { type InstallRunner, installDependencies } from "./install";
import { UnavailableError } from "./errors";

const MODEL_HASH = /^[a-f0-9]{64}$/;
const COMPLETE = ".complet";
const USED = ".utilise";
const STALE_TEMPORARY = /^[a-f0-9]{64}\.tmp-/;
const STALE_TEMPORARY_MS = 60 * 60_000;

export type RobocopyRunner = (source: string, destination: string) => { status: number | null; output: string; error?: string };

/** Exécuteurs remplaçables : les tests ne lancent ni Bun ni robocopy. */
export type DependencyDeps = {
  install?: InstallRunner;
  robocopy?: RobocopyRunner;
};

function depsDir(stateParent: string): string {
  return path.join(stateParent, "deps");
}

function modelDir(stateParent: string, hash: string): string {
  return path.join(depsDir(stateParent), hash);
}

function isDirectoryNotLink(candidate: string): boolean {
  try {
    const entry = lstatSync(candidate);
    return entry.isDirectory() && !entry.isSymbolicLink();
  } catch {
    return false;
  }
}

function isComplete(candidate: string): boolean {
  return isDirectoryNotLink(candidate) && existsSync(path.join(candidate, COMPLETE)) && isDirectoryNotLink(path.join(candidate, "node_modules"));
}

function removeModel(candidate: string): void {
  if (!isDirectoryNotLink(candidate)) throw new UnavailableError(`Le modèle de dépendances n'est pas un dossier sûr : ${candidate}`);
  rmSync(candidate, { recursive: true, force: true, maxRetries: 3 });
}

function runRobocopy(source: string, destination: string): ReturnType<RobocopyRunner> {
  const result = spawnSync("robocopy", [source, destination, "/MIR", "/MT:16", "/XJ", "/R:1", "/W:1", "/NFL", "/NDL", "/NJH", "/NJS", "/NP"], {
    encoding: "utf8",
    windowsHide: true,
  });
  return { status: result.status, output: `${result.stdout ?? ""}${result.stderr ?? ""}`, error: result.error?.message };
}

export function dependencyHash(lockfile: string): string {
  return createHash("sha256").update(readFileSync(lockfile)).digest("hex");
}

/**
 * Les vrais dossiers de modèle. Un lien, une jonction ou un fichier au nom d'empreinte est laissé en place avec
 * un avertissement : lever ici interromprait le nettoyage des autres modèles (après `--sortie-bac-a-sable`, il
 * tourne dans un `finally`), et `ensureDependencyModel` refuse de toute façon de copier depuis une telle entrée.
 */
function modelDirectories(directory: string, entries: readonly Dirent[]): string[] {
  const directories: string[] = [];
  for (const entry of entries.filter((candidate) => MODEL_HASH.test(candidate.name))) {
    const candidate = path.join(directory, entry.name);
    if (isDirectoryNotLink(candidate)) directories.push(candidate);
    else console.error(`AVERTISSEMENT : ${candidate} n'est pas un dossier de modèle (lien, jonction ou fichier) : laissé en place, sans le suivre.`);
  }
  return directories;
}

/** Supprime les modèles excédentaires, sans jamais suivre un lien ou une jonction. */
export function pruneDependencyModels(stateParent: string, keep = 3): void {
  const directory = depsDir(stateParent);
  if (!existsSync(directory)) return;
  const models = readdirSync(directory, { withFileTypes: true });
  // Construction interrompue (processus tué, disque plein) : son dossier temporaire reste. Au-delà d'une
  // heure, aucune construction en cours ne peut encore s'en servir.
  for (const entry of models.filter((candidate) => STALE_TEMPORARY.test(candidate.name))) {
    const candidate = path.join(directory, entry.name);
    if (isDirectoryNotLink(candidate) && Date.now() - statSync(candidate).mtimeMs > STALE_TEMPORARY_MS) removeModel(candidate);
  }
  modelDirectories(directory, models)
    .sort((left, right) => {
      const leftUsed = path.join(left, USED);
      const rightUsed = path.join(right, USED);
      const leftTime = existsSync(leftUsed) ? statSync(leftUsed).mtimeMs : 0;
      const rightTime = existsSync(rightUsed) ? statSync(rightUsed).mtimeMs : 0;
      return rightTime - leftTime;
    })
    .slice(keep)
    .forEach(removeModel);
}

/** Supprime tous les modèles dont le nom est une empreinte valide, sans suivre les liens. */
export function cleanDependencyModels(stateParent: string): void {
  const directory = depsDir(stateParent);
  if (!existsSync(directory)) return;
  modelDirectories(directory, readdirSync(directory, { withFileTypes: true })).forEach(removeModel);
}

/** Construit une seule fois le modèle correspondant au bun.lock du dossier demandé. */
export function ensureDependencyModel(projectDir: string, stateParent: string, deps: DependencyDeps = {}): string {
  const lockfile = path.join(projectDir, "bun.lock");
  const packageJson = path.join(projectDir, "package.json");
  if (!existsSync(lockfile) || !existsSync(packageJson)) throw new UnavailableError(`package.json ou bun.lock est absent de ${projectDir}.`);
  const hash = dependencyHash(lockfile);
  const destination = modelDir(stateParent, hash);
  if (isComplete(destination)) return destination;

  mkdirSync(depsDir(stateParent), { recursive: true });
  if (existsSync(destination)) {
    if (isComplete(destination)) return destination;
    removeModel(destination);
  }
  const temporary = path.join(depsDir(stateParent), `${hash}.tmp-${process.pid}-${Math.random().toString(16).slice(2)}`);
  mkdirSync(temporary);
  try {
    cpSync(packageJson, path.join(temporary, "package.json"));
    cpSync(lockfile, path.join(temporary, "bun.lock"));
    const bunfig = path.join(projectDir, "bunfig.toml");
    if (existsSync(bunfig)) cpSync(bunfig, path.join(temporary, "bunfig.toml"));
    installDependencies(temporary, deps.install);
    writeFileSync(path.join(temporary, USED), "utilisé\n");
    writeFileSync(path.join(temporary, COMPLETE), "ok\n");
    try {
      renameSync(temporary, destination);
    } catch (error) {
      if (!isComplete(destination)) throw error;
      rmSync(temporary, { recursive: true, force: true, maxRetries: 3 });
    }
    pruneDependencyModels(stateParent);
    return destination;
  } catch (error) {
    rmSync(temporary, { recursive: true, force: true, maxRetries: 3 });
    if (error instanceof UnavailableError) throw error;
    throw new UnavailableError(`Construction du modèle de dépendances impossible : ${error instanceof Error ? error.message : String(error)}`);
  }
}

/** Copie le modèle vers un projet : aucun lien ou jonction vers le cache n'est créé. */
export function copyDependencies(projectDir: string, stateParent: string, deps: DependencyDeps = {}): void {
  const model = ensureDependencyModel(projectDir, stateParent, deps);
  const source = path.join(model, "node_modules");
  const destination = path.join(projectDir, "node_modules");
  // Marqué utilisé AVANT la copie : une construction concurrente qui fait le ménage ne doit pas le supprimer
  // pendant qu'on le lit.
  const used = path.join(model, USED);
  writeFileSync(used, "utilisé\n");
  const now = new Date();
  utimesSync(used, now, now);
  console.error(`Copie des dépendances dans ${projectDir}…`);
  const started = Date.now();
  if (process.platform === "win32") {
    const result = (deps.robocopy ?? runRobocopy)(source, destination);
    if (result.status === null || result.status >= 8) {
      throw new UnavailableError(`robocopy a échoué (${result.error ?? `code ${result.status}`}) : ${result.output.trimEnd()}`);
    }
  } else {
    try {
      cpSync(source, destination, { recursive: true, dereference: false });
    } catch (error) {
      throw new UnavailableError(`Copie des dépendances impossible : ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  console.error(`Dépendances copiées en ${Math.round((Date.now() - started) / 1000)} s.`);
}
