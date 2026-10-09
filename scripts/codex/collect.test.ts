import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { collectChanges, gitIgnoreCheck, hasChanges, listTree, scanSrc, type IgnoreCheck } from "./collect";
import { TamperedWorkError, UnavailableError } from "./errors";

const temps: string[] = [];

function tempDir(): string {
  const dir = realpathSync.native(mkdtempSync(path.join(os.tmpdir(), "typio-codex-collect-")));
  temps.push(dir);
  return dir;
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
});

function put(root: string, files: Record<string, string>): void {
  for (const [rel, content] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    writeFileSync(path.join(root, rel), content);
  }
}

/** `base/` et `src/` identiques au départ, comme après `extractCommit`. */
function makeWork(files: Record<string, string> = { "a.txt": "a\n", "docs/b.md": "b\n", "keep.txt": "k\n" }) {
  const dir = tempDir();
  const base = path.join(dir, "base");
  const src = path.join(dir, "src");
  put(base, files);
  put(src, files);
  return { dir, base, src };
}

const noIgnore: IgnoreCheck = () => new Set();

function git(cwd: string, ...args: string[]): string {
  const result = spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...args], { cwd, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} : ${result.stderr}`);
  return result.stdout;
}

describe("collectChanges : fichiers ajoutés, modifiés, supprimés", () => {
  it("rien n'a changé : aucun changement", () => {
    const { base, src } = makeWork();
    const changes = collectChanges(base, src, noIgnore);
    expect(changes).toEqual({ added: [], modified: [], deleted: [], ignored: [] });
    expect(hasChanges(changes)).toBe(false);
  });

  it("ajout, modification (contenu différent) et suppression", () => {
    const { base, src } = makeWork();
    put(src, { "docs/nouveau.md": "n\n", "src/profond/x.ts": "x\n", "a.txt": "a modifié\n" });
    rmSync(path.join(src, "keep.txt"));
    const changes = collectChanges(base, src, noIgnore);
    expect(changes).toEqual({
      added: ["docs/nouveau.md", "src/profond/x.ts"],
      modified: ["a.txt"],
      deleted: ["keep.txt"],
      ignored: [],
    });
    expect(hasChanges(changes)).toBe(true);
  });

  it("une modification de même taille est vue (le contenu est comparé)", () => {
    const { base, src } = makeWork({ "a.txt": "aaaa\n" });
    put(src, { "a.txt": "aaab\n" });
    expect(collectChanges(base, src, noIgnore).modified).toEqual(["a.txt"]);
  });

  it("un fichier réécrit à l'identique n'est pas un changement", () => {
    const { base, src } = makeWork();
    put(src, { "a.txt": "a\n" });
    expect(hasChanges(collectChanges(base, src, noIgnore))).toBe(false);
  });

  it("un fichier qui devient un dossier, et l'inverse", () => {
    const { base, src } = makeWork({ "a": "fichier\n", "d/x.txt": "x\n" });
    rmSync(path.join(src, "a"));
    put(src, { "a/y.txt": "y\n" });
    rmSync(path.join(src, "d"), { recursive: true });
    put(src, { d: "fichier maintenant\n" });
    const changes = collectChanges(base, src, noIgnore);
    expect(changes.deleted).toEqual(["a", "d/x.txt"]);
    expect(changes.added).toEqual(["a/y.txt", "d"]);
  });

  it("node_modules/ et .next/ à la racine sont exclus ; ailleurs ils comptent", () => {
    const { base, src } = makeWork();
    put(src, {
      "node_modules/paquet/index.js": "x\n",
      ".next/cache/x": "x\n",
      "sous/node_modules/paquet.js": "y\n",
      "sous/.next/z": "z\n",
    });
    expect(collectChanges(base, src, noIgnore).added).toEqual(["sous/.next/z", "sous/node_modules/paquet.js"]);
  });

  it("node_modules/ racine peut être une jonction : elle n'est ni suivie ni reportée", () => {
    const { base, src } = makeWork();
    const outside = tempDir();
    put(outside, { "secret.txt": "s\n" });
    symlinkSync(outside, path.join(src, "node_modules"), "junction");
    expect(collectChanges(base, src, noIgnore)).toEqual({ added: [], modified: [], deleted: [], ignored: [] });
    expect(listTree(src).map((entry) => entry.rel)).not.toContain("node_modules");
  });
});

describe("collectChanges : fichiers ignorés", () => {
  it("les fichiers ajoutés ignorés sont listés à part, pas reportés", () => {
    const { base, src } = makeWork();
    put(src, { "docs/nouveau.md": "n\n", "dist/x.js": "x\n", "debug.log": "l\n" });
    const seen: string[][] = [];
    const changes = collectChanges(base, src, (paths) => {
      seen.push([...paths]);
      return new Set(paths.filter((rel) => rel.startsWith("dist/") || rel.endsWith(".log")));
    });
    expect(changes.added).toEqual(["docs/nouveau.md"]);
    expect(changes.ignored).toEqual(["debug.log", "dist/x.js"]);
    // Seuls les ajouts sont soumis au filtre : les fichiers de la base sont suivis.
    expect(seen).toHaveLength(1);
    expect([...(seen[0] ?? [])].sort()).toEqual(["debug.log", "dist/x.js", "docs/nouveau.md"]);
    expect(seen[0]).not.toContain("a.txt");
  });

  it("un fichier suivi modifié ou supprimé est toujours reporté, même si un motif l'ignore", () => {
    const { base, src } = makeWork({ "forcé.log": "v1\n", "autre.log": "x\n" });
    put(src, { "forcé.log": "v2\n" });
    rmSync(path.join(src, "autre.log"));
    const changes = collectChanges(base, src, (paths) => new Set(paths));
    expect(changes.modified).toEqual(["forcé.log"]);
    expect(changes.deleted).toEqual(["autre.log"]);
    expect(changes.ignored).toEqual([]);
  });

  it("gitIgnoreCheck : lancé depuis le dépôt principal, chemins sur l'entrée standard", () => {
    const calls: { cwd: string; args: readonly string[]; input?: string }[] = [];
    const check = gitIgnoreCheck("C:\\principal", ((cwd: string, args: readonly string[], input?: string) => {
      calls.push({ cwd, args, input });
      return { status: 0, stdout: "dist/x.js\0", stderr: "" };
    }) as never);
    expect(check(["dist/x.js", "docs/n.md"])).toEqual(new Set(["dist/x.js"]));
    expect(calls).toHaveLength(1);
    expect(calls[0]?.cwd).toBe("C:\\principal");
    expect(calls[0]?.args).toEqual(["check-ignore", "--no-index", "--stdin", "-z"]);
    expect(calls[0]?.input).toBe("dist/x.js\0docs/n.md\0");
  });

  it("gitIgnoreCheck : code 1 = rien d'ignoré ; autre code = Codex indisponible ; liste vide = aucun appel", () => {
    const run = vi.fn();
    expect(gitIgnoreCheck("r", run as never)([])).toEqual(new Set());
    expect(run).not.toHaveBeenCalled();
    run.mockReturnValueOnce({ status: 1, stdout: "", stderr: "" });
    expect(gitIgnoreCheck("r", run as never)(["a"])).toEqual(new Set());
    run.mockReturnValueOnce({ status: 128, stdout: "", stderr: "fatal: pas un dépôt" });
    expect(() => gitIgnoreCheck("r", run as never)(["a"])).toThrow(UnavailableError);
  });

  it("gitIgnoreCheck avec un vrai dépôt : les règles du dépôt principal, pas celles écrites par Codex", () => {
    const repo = tempDir();
    git(repo, "init", "-q", "-b", "main");
    writeFileSync(path.join(repo, ".gitignore"), "dist/\n*.log\n!.env.example\n");
    git(repo, "add", ".");
    git(repo, "commit", "-q", "-m", "init");
    const { base, src } = makeWork();
    // Codex tente de « dé-ignorer » en écrivant son propre .gitignore dans src : sans effet.
    put(src, { ".gitignore": "!*.log\n", "dist/x.js": "x\n", "debug.log": "l\n", "docs/n.md": "n\n" });
    const changes = collectChanges(base, src, gitIgnoreCheck(repo));
    expect(changes.ignored).toEqual(["debug.log", "dist/x.js"]);
    expect(changes.added).toEqual([".gitignore", "docs/n.md"]);
  });
});

describe("collectChanges : travail refusé (ALERTE)", () => {
  function expectAlert(setup: (src: string) => void, base?: Record<string, string>): void {
    const { base: baseDir, src } = makeWork(base);
    setup(src);
    const isIgnored = vi.fn(noIgnore);
    expect(() => collectChanges(baseDir, src, isIgnored)).toThrow(TamperedWorkError);
    expect(() => collectChanges(baseDir, src, isIgnored)).toThrow(/^ALERTE/);
    // Le refus vient avant tout autre traitement, git compris.
    expect(isIgnored).not.toHaveBeenCalled();
  }

  it("AC-1 : un dépôt git imbriqué piégé est refusé, et aucune commande git n'est lancée sur src", () => {
    const { base, src } = makeWork();
    const witness = path.join(tempDir(), "execute.txt").replaceAll("\\", "/");
    const evil = path.join(src, "evil");
    mkdirSync(evil);
    git(evil, "init", "-q", "-b", "main");
    git(evil, "config", "filter.x.clean", `touch '${witness}'; cat`);
    writeFileSync(path.join(evil, ".gitattributes"), "* filter=x\n");
    writeFileSync(path.join(evil, "f.txt"), "piège\n");
    // Témoin : un git lancé dans ce dossier exécuterait bien le filtre, sinon le test ne prouverait rien.
    git(evil, "add", "f.txt");
    expect(existsSync(witness)).toBe(true);
    rmSync(witness);

    const isIgnored = vi.fn(noIgnore);
    expect(() => collectChanges(base, src, isIgnored)).toThrow(TamperedWorkError);
    expect(() => collectChanges(base, src, isIgnored)).toThrow(/evil\/\.git/);
    expect(existsSync(witness)).toBe(false);
    expect(isIgnored).not.toHaveBeenCalled();
  });

  it("AC-1 : un src/evil/.git/config écrit à la main est refusé", () => {
    expectAlert((src) => put(src, { "evil/.git/config": '[filter "x"]\n\tclean = calc\n', "evil/.gitattributes": "* filter=x\n" }));
  });

  it("une entrée .git à n'importe quelle profondeur, fichier ou dossier", () => {
    expectAlert((src) => put(src, { ".git": "gitdir: C:/ailleurs\n" }));
    expectAlert((src) => put(src, { "a/b/c/.git/HEAD": "ref\n" }));
    expectAlert((src) => put(src, { "a/b/.git": "gitdir: x\n" }));
  });

  it("le nom court 8.3 de .git (GIT~1) est refusé aussi", () => {
    expectAlert((src) => put(src, { "GIT~1/config": "x\n" }));
  });

  it("AC-2 : un .gitmodules est refusé", () => {
    expectAlert((src) => put(src, { ".gitmodules": '[submodule "x"]\n\turl = https://example.com/x\n' }));
    expectAlert((src) => put(src, { "sous/.gitmodules": "x\n" }));
  });

  it("AC-2 : un lien symbolique ou une jonction est refusé", () => {
    expectAlert((src) => symlinkSync(tempDir(), path.join(src, "lien"), "junction"));
    expectAlert((src) => symlinkSync(tempDir(), path.join(src, "docs", "lien"), "junction"));
  });

  it("un lien est refusé même s'il existe à l'identique dans la base", () => {
    const { base, src } = makeWork();
    const target = tempDir();
    symlinkSync(target, path.join(base, "lien"), "junction");
    symlinkSync(target, path.join(src, "lien"), "junction");
    expect(() => collectChanges(base, src, noIgnore)).toThrow(TamperedWorkError);
  });

  it.each([".env", ".env.local", ".env.production", "config/.env", "tls.pem", "cle.key", "id_rsa", "id_ed25519.pub"])(
    "AC-2 : un fichier sensible nouveau est refusé (%s)",
    (name) => {
      expectAlert((src) => put(src, { [name]: "SECRET=1\n" }));
    },
  );

  it("un dossier sensible nouveau est refusé (.env/x)", () => {
    expectAlert((src) => put(src, { ".env/note.md": "x\n" }));
  });

  it(".env.example est versionné et autorisé", () => {
    const { base, src } = makeWork();
    put(src, { ".env.example": "DATABASE_URL=\n" });
    expect(collectChanges(base, src, noIgnore).added).toEqual([".env.example"]);
  });

  it("un fichier sensible déjà dans la base n'est pas « nouveau »", () => {
    const { base, src } = makeWork({ "config/.env.local": "v1\n", "a.txt": "a\n" });
    put(src, { "config/.env.local": "v2\n" });
    expect(collectChanges(base, src, noIgnore).modified).toEqual(["config/.env.local"]);
  });
});

describe(".codex/ et scanSrc : balayage de src seul, avant le lint", () => {
  it("AC-2 : un dossier .codex/ est une ALERTE, avec ou sans la base", () => {
    const { base, src } = makeWork();
    put(src, { ".codex/config.toml": 'sandbox_mode = "danger-full-access"\n' });
    expect(() => scanSrc(src)).toThrow(TamperedWorkError);
    expect(() => scanSrc(src)).toThrow(/^ALERTE.*\.codex/);
    expect(() => collectChanges(base, src, noIgnore)).toThrow(/^ALERTE.*\.codex/);
  });

  it("à n'importe quelle profondeur, et même si la base le contient", () => {
    const { base, src } = makeWork({ "docs/.codex/config.toml": "x = 1\n", "a.txt": "a\n" });
    expect(() => scanSrc(src)).toThrow(TamperedWorkError);
    expect(() => collectChanges(base, src, noIgnore)).toThrow(TamperedWorkError);
  });

  it("refuse aussi .git, .gitmodules et les liens sans connaître la base", () => {
    for (const setup of [
      (src: string) => put(src, { "evil/.git/config": "x\n" }),
      (src: string) => put(src, { ".gitmodules": "x\n" }),
      (src: string) => symlinkSync(tempDir(), path.join(src, "lien"), "junction"),
    ]) {
      const { src } = makeWork();
      setup(src);
      expect(() => scanSrc(src)).toThrow(TamperedWorkError);
    }
  });

  it("ne juge pas les fichiers sensibles (il faut la base pour savoir s'ils sont nouveaux) ; un src ordinaire passe", () => {
    const { src } = makeWork();
    put(src, { ".env.local": "SECRET=1\n" });
    expect(() => scanSrc(src)).not.toThrow();
    const plain = makeWork();
    expect(() => scanSrc(plain.src)).not.toThrow();
  });
});
