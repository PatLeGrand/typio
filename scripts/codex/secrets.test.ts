import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TamperedWorkError } from "./errors";
import {
  assertNoSecrets,
  collectJsonStrings,
  defaultSecretSources,
  findSecretLeaks,
  mainRepoRoot,
  parseEnvValues,
  secretForms,
  withoutPublicValues,
  type SecretSource,
} from "./secrets";

// Ces tests montent de vrais dépôts git : sous la charge de la suite complète, ils dépassent les 5 s par défaut.
vi.setConfig({ testTimeout: 30_000 });

const temps: string[] = [];

function tempDir(): string {
  const dir = realpathSync.native(mkdtempSync(path.join(os.tmpdir(), "typio-codex-secrets-")));
  temps.push(dir);
  return dir;
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
});

// Valeurs synthétiques : aucune ne vient d'un vrai fichier.
const ENV_SECRET = "s3cr3t-valeur-de-test-0001";
const AUTH_SECRET = "jeton-synthetique-de-test-abcdefghij-0002";
const sources: SecretSource[] = [
  { label: ".env.local", values: [ENV_SECRET] },
  { label: "auth.json", values: [AUTH_SECRET] },
];

function put(root: string, files: Record<string, string | Buffer>): void {
  for (const [rel, content] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    writeFileSync(path.join(root, rel), content);
  }
}

describe("parseEnvValues", () => {
  it("garde les valeurs d'au moins 16 caractères, sans guillemets ni commentaires", () => {
    const values = parseEnvValues(
      [
        "# commentaire = longue-valeur-en-commentaire",
        "",
        "DATABASE_URL=postgres://u:p@localhost:5433/typio",
        'AUTH_SECRET="valeur entre guillemets"',
        "AUTH_ID='abcdefghijklmnop'",
        "NODE_ENV=development",
        "COURT=abc",
        "SANS_VALEUR=",
        "pas une affectation",
        "REPETE=postgres://u:p@localhost:5433/typio",
      ].join("\n"),
    );
    expect(values).toEqual(["postgres://u:p@localhost:5433/typio", "valeur entre guillemets", "abcdefghijklmnop"]);
  });

  it("lit les fins de ligne Windows", () => {
    expect(parseEnvValues("A=valeur-assez-longue\r\nB=autre-valeur-longue\r\n")).toEqual(["valeur-assez-longue", "autre-valeur-longue"]);
  });
});

describe("collectJsonStrings", () => {
  it("prend les chaînes d'au moins 20 caractères, à toute profondeur", () => {
    const json = { OPENAI_API_KEY: "sk-0123456789abcdefghij", tokens: { access: "a".repeat(25), refresh: ["court", "r".repeat(30)] }, n: 5, court: "x" };
    expect(collectJsonStrings(json).sort()).toEqual(["a".repeat(25), "r".repeat(30), "sk-0123456789abcdefghij"].sort());
  });
});

describe("secretForms", () => {
  it("la valeur et ses formes base64, standard et url-safe", () => {
    const value = "a?b>c~d?e>f~g?";
    const standard = Buffer.from(value).toString("base64");
    expect(standard).toMatch(/[+/]/);
    const forms = secretForms(value);
    expect(forms).toContain(value);
    expect(forms).toContain(standard);
    expect(forms).toContain(standard.replace(/=+$/, ""));
    expect(forms).toContain(standard.replaceAll("+", "-").replaceAll("/", "_"));
  });
});

describe("findSecretLeaks / assertNoSecrets", () => {
  it("trouve la valeur exacte, et la source", () => {
    const src = tempDir();
    put(src, { "docs/note.md": `la clé est ${ENV_SECRET} ici\n`, "ok.md": "rien\n" });
    expect(findSecretLeaks(src, ["docs/note.md", "ok.md"], sources)).toEqual([{ file: "docs/note.md", source: ".env.local" }]);
  });

  it("trouve les valeurs de auth.json", () => {
    const src = tempDir();
    put(src, { "a.ts": `const t = "${AUTH_SECRET}";\n` });
    expect(findSecretLeaks(src, ["a.ts"], sources)).toEqual([{ file: "a.ts", source: "auth.json" }]);
  });

  it("trouve la forme base64 standard, url-safe, avec et sans remplissage", () => {
    const value = "valeur?de>test~avec+des/caracteres!";
    const source: SecretSource = { label: ".env.local", values: [value] };
    const standard = Buffer.from(value).toString("base64");
    const urlSafe = standard.replaceAll("+", "-").replaceAll("/", "_");
    const src = tempDir();
    put(src, {
      "standard.txt": `x=${standard}\n`,
      "sans-remplissage.txt": `x=${standard.replace(/=+$/, "")}\n`,
      "url.txt": `x=${urlSafe}\n`,
      "propre.txt": "x=rien\n",
    });
    const leaks = findSecretLeaks(src, ["standard.txt", "sans-remplissage.txt", "url.txt", "propre.txt"], [source]);
    expect(leaks.map(({ file }) => file)).toEqual(["standard.txt", "sans-remplissage.txt", "url.txt"]);
  });

  it("lit aussi les fichiers binaires", () => {
    const src = tempDir();
    put(src, { "b.bin": Buffer.concat([Buffer.from([0, 255, 1]), Buffer.from(ENV_SECRET), Buffer.from([0, 2])]) });
    expect(findSecretLeaks(src, ["b.bin"], sources)).toHaveLength(1);
  });

  it("rien dans un fichier ordinaire ; sans source, rien à chercher", () => {
    const src = tempDir();
    put(src, { "a.md": "bonjour\n" });
    expect(findSecretLeaks(src, ["a.md"], sources)).toEqual([]);
    expect(findSecretLeaks(src, ["a.md"], [])).toEqual([]);
    expect(findSecretLeaks(src, ["a.md"], [{ label: ".env.local", values: [] }])).toEqual([]);
  });

  it("une correspondance lève une ALERTE qui donne le chemin et la source, jamais la valeur", () => {
    const src = tempDir();
    put(src, { "docs/note.md": `${ENV_SECRET}\n`, "autre.ts": `${AUTH_SECRET}\n` });
    let message = "";
    try {
      assertNoSecrets(src, ["docs/note.md", "autre.ts"], sources);
    } catch (error) {
      expect(error).toBeInstanceOf(TamperedWorkError);
      message = (error as Error).message;
    }
    expect(message).toMatch(/^ALERTE/);
    expect(message).toContain("docs/note.md");
    expect(message).toContain(".env.local");
    expect(message).toContain("autre.ts");
    expect(message).toContain("auth.json");
    expect(message).not.toContain(ENV_SECRET);
    expect(message).not.toContain(AUTH_SECRET);
    expect(message).not.toContain(Buffer.from(ENV_SECRET).toString("base64"));
  });

  it("aucune fuite : pas d'erreur", () => {
    const src = tempDir();
    put(src, { "a.md": "rien\n" });
    expect(() => assertNoSecrets(src, ["a.md"], sources)).not.toThrow();
  });
});

describe("defaultSecretSources : fichiers injectés", () => {
  function git(cwd: string, ...args: string[]): string {
    const result = spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...args], { cwd, encoding: "utf8" });
    if (result.status !== 0) throw new Error(`git ${args.join(" ")} : ${result.stderr}`);
    return result.stdout;
  }

  function makeRepo(): string {
    const dir = tempDir();
    git(dir, "init", "-q", "-b", "main");
    writeFileSync(path.join(dir, "a.txt"), "a\n");
    git(dir, "add", ".");
    git(dir, "commit", "-q", "-m", "init");
    return dir;
  }

  it("lit le .env.local de la racine du dépôt principal, depuis un worktree, et le auth.json injecté", () => {
    const repo = makeRepo();
    writeFileSync(path.join(repo, ".env.local"), `SECRET=${ENV_SECRET}\nCOURT=abc\n`);
    const worktree = path.join(tempDir(), "wt");
    git(repo, "worktree", "add", "-q", "-b", "autre", worktree);
    expect(mainRepoRoot(worktree)).toBe(repo);
    const authFile = path.join(tempDir(), "auth.json");
    writeFileSync(authFile, JSON.stringify({ OPENAI_API_KEY: AUTH_SECRET, court: "x" }));
    expect(defaultSecretSources(worktree, authFile)).toEqual([
      { label: ".env.local", values: [ENV_SECRET] },
      { label: "auth.json", values: [AUTH_SECRET] },
    ]);
  });

  it("fichier absent ou illisible : on continue avec un avertissement", () => {
    const repo = makeRepo();
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const authFile = path.join(tempDir(), "auth.json");
    writeFileSync(authFile, "{ pas du json");
    expect(defaultSecretSources(repo, path.join(tempDir(), "absent.json"))).toEqual([]);
    expect(defaultSecretSources(repo, authFile)).toEqual([]);
    const warnings = log.mock.calls.map((call) => String(call[0]));
    expect(warnings.filter((line) => line.includes("AVERTISSEMENT"))).toHaveLength(4);
    expect(warnings.some((line) => line.includes("auth.json illisible"))).toBe(true);
    expect(warnings.join("\n")).not.toContain("pas du json");
  });

  it("P3 : un auth.json au JSON invalide n'est jamais cité, même partiellement", () => {
    const repo = makeRepo();
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const authFile = path.join(tempDir(), "auth.json");
    writeFileSync(authFile, `{ "OPENAI_API_KEY": "${AUTH_SECRET}`);
    expect(defaultSecretSources(repo, authFile)).toEqual([]);
    const warnings = log.mock.calls.map((call) => String(call[0])).join("\n");
    expect(warnings).toContain("auth.json illisible, ignoré");
    expect(warnings).not.toContain(AUTH_SECRET.slice(0, 10));
  });
});

describe("withoutPublicValues : une valeur déjà dans base/ n'est pas un secret", () => {
  const PUBLIC_URL = "postgres://typio:pw@localhost:5433/typio";

  function makeBase(files: Record<string, string>): string {
    const base = tempDir();
    put(base, files);
    return base;
  }

  it("retire les valeurs présentes en clair dans au moins un fichier de base/, garde les autres", () => {
    const base = makeBase({ "README.md": `Base locale : ${PUBLIC_URL}\n`, "docs/a.md": "rien\n" });
    const result = withoutPublicValues(base, [
      { label: ".env.local", values: [PUBLIC_URL, ENV_SECRET] },
      { label: "auth.json", values: [AUTH_SECRET] },
    ]);
    expect(result).toEqual([
      { label: ".env.local", values: [ENV_SECRET] },
      { label: "auth.json", values: [AUTH_SECRET] },
    ]);
  });

  it("n'ignore pas node_modules/ ni .next/ à la racine (non lus) ; lit les sous-dossiers", () => {
    const base = makeBase({ "node_modules/p/i.js": `${ENV_SECRET}\n`, ".next/c": `${ENV_SECRET}\n`, "a/b/c.md": `${PUBLIC_URL}\n` });
    const [source] = withoutPublicValues(base, [{ label: ".env.local", values: [PUBLIC_URL, ENV_SECRET] }]);
    expect(source?.values).toEqual([ENV_SECRET]);
  });

  it("fichier modifié qui contenait déjà la valeur dans base/ : pas d'ALERTE", () => {
    const base = makeBase({ "README.md": `Base : ${PUBLIC_URL}\n` });
    const src = tempDir();
    put(src, { "README.md": `Base : ${PUBLIC_URL}\nUne ligne de plus.\n` });
    const sources = withoutPublicValues(base, [{ label: ".env.local", values: [PUBLIC_URL] }]);
    expect(() => assertNoSecrets(src, ["README.md"], sources)).not.toThrow();
  });

  it("nouveau fichier qui contient une valeur présente ailleurs dans base/ : pas d'ALERTE", () => {
    const base = makeBase({ "docs/a.md": `${PUBLIC_URL}\n` });
    const src = tempDir();
    put(src, { "docs/nouveau.md": `Voir ${PUBLIC_URL}\n` });
    const sources = withoutPublicValues(base, [{ label: ".env.local", values: [PUBLIC_URL] }]);
    expect(() => assertNoSecrets(src, ["docs/nouveau.md"], sources)).not.toThrow();
  });

  it("valeur absente de base/ : ALERTE, comme avant", () => {
    const base = makeBase({ "README.md": `Base : ${PUBLIC_URL}\n` });
    const src = tempDir();
    put(src, { "docs/nouveau.md": `clé : ${ENV_SECRET}\n` });
    const sources = withoutPublicValues(base, [{ label: ".env.local", values: [PUBLIC_URL, ENV_SECRET] }]);
    expect(() => assertNoSecrets(src, ["docs/nouveau.md"], sources)).toThrow(TamperedWorkError);
  });

  it("la forme base64 d'une valeur retenue reste cherchée ; celle d'une valeur publique ne l'est plus", () => {
    const base = makeBase({ "README.md": `Base : ${PUBLIC_URL}\n` });
    const src = tempDir();
    put(src, {
      "secret.txt": `x=${Buffer.from(ENV_SECRET).toString("base64")}\n`,
      "public.txt": `x=${Buffer.from(PUBLIC_URL).toString("base64")}\n`,
    });
    const sources = withoutPublicValues(base, [{ label: ".env.local", values: [PUBLIC_URL, ENV_SECRET] }]);
    expect(findSecretLeaks(src, ["secret.txt", "public.txt"], sources)).toEqual([{ file: "secret.txt", source: ".env.local" }]);
  });

  it("sans valeur à chercher, base/ n'est pas lue", () => {
    expect(withoutPublicValues(path.join(tempDir(), "absente"), [{ label: ".env.local", values: [] }])).toEqual([{ label: ".env.local", values: [] }]);
  });
});
