import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildCodexArgs,
  describeFailure,
  hasDeniedWrite,
  isLocalDatabaseUrl,
  parseCodexEvents,
  parseEffort,
  resolveCodexBinary,
  safeEnv,
  type BinaryLookup,
  type CodexRun,
} from "./codex";
import { UsageError } from "./errors";
import { copySnapshot, isSensitivePath, sensitiveExcludes } from "./snapshot";
import { buildPrompt, TASKS } from "./tasks";

const baseOptions = {
  cwd: "C:\\Temp\\typio-codex-abc\\repo",
  lastMessageFile: "C:\\Temp\\typio-codex-abc\\last.txt",
  model: "gpt-6-luna",
};

describe("buildCodexArgs", () => {
  const args = buildCodexArgs({ ...baseOptions, effort: "medium" });

  it("impose la lecture seule, sans approbation et sans config utilisateur", () => {
    expect(args).toContain("--ignore-user-config");
    expect(args).toContain("--strict-config");
    expect(args).toContain("--ephemeral");
    expect(args).toContain("--skip-git-repo-check");
    expect(args.slice(args.indexOf("-s"), args.indexOf("-s") + 2)).toEqual(["-s", "read-only"]);
    expect(args).toContain('approval_policy="never"');
    expect(args).toContain('windows.sandbox="unelevated"');
  });

  it("ne contourne jamais le bac à sable", () => {
    expect(args).not.toContain("--dangerously-bypass-approvals-and-sandbox");
    expect(args).not.toContain("danger-full-access");
    expect(args).not.toContain("workspace-write");
  });

  it("travaille dans la copie, lit le prompt sur stdin et écrit le dernier message à part", () => {
    expect(args[args.indexOf("-C") + 1]).toBe(baseOptions.cwd);
    expect(args[args.indexOf("-o") + 1]).toBe(baseOptions.lastMessageFile);
    expect(args.at(-1)).toBe("-");
    expect(args).toContain("--json");
  });

  it("règle l'effort de raisonnement", () => {
    expect(buildCodexArgs({ ...baseOptions, effort: "low" })).toContain('model_reasoning_effort="low"');
    expect(args).toContain('model_reasoning_effort="medium"');
  });

  it("impose toujours le modèle : sans -m, Codex prend son défaut avec un effort none", () => {
    expect(args[args.indexOf("-m") + 1]).toBe("gpt-6-luna");
    const withModel = buildCodexArgs({ ...baseOptions, effort: "low", model: "gpt-x" });
    expect(withModel[withModel.indexOf("-m") + 1]).toBe("gpt-x");
  });

  it("ne mentionne le réseau que dans le mode écriture", () => {
    expect(args.some((arg) => arg.includes("network_access"))).toBe(false);
  });
});

describe("buildCodexArgs en écriture", () => {
  const args = buildCodexArgs({ ...baseOptions, effort: "medium", model: "gpt-5.6-terra", sandbox: "workspace-write" });

  it("écrit dans le worktree avec le réseau coupé explicitement", () => {
    expect(args.slice(args.indexOf("-s"), args.indexOf("-s") + 2)).toEqual(["-s", "workspace-write"]);
    expect(args).toContain("sandbox_workspace_write.network_access=false");
    expect(args).toContain('approval_policy="never"');
    expect(args).toContain('windows.sandbox="unelevated"');
    expect(args).toContain("--ignore-user-config");
  });

  it("impose le modèle et l'effort, et lit le prompt sur stdin", () => {
    expect(args[args.indexOf("-m") + 1]).toBe("gpt-5.6-terra");
    expect(args).toContain('model_reasoning_effort="medium"');
    expect(args[args.indexOf("-C") + 1]).toBe(baseOptions.cwd);
    expect(args.at(-1)).toBe("-");
  });

  it("ne contourne jamais le bac à sable", () => {
    expect(args).not.toContain("--dangerously-bypass-approvals-and-sandbox");
    expect(args).not.toContain("danger-full-access");
    expect(args).not.toContain("read-only");
  });
});

describe("buildCodexArgs en sortie du bac à sable", () => {
  const args = buildCodexArgs({ ...baseOptions, effort: "medium", sandbox: "danger-full-access" });

  it("passe par danger-full-access, jamais par le contournement total de Codex", () => {
    expect(args.slice(args.indexOf("-s"), args.indexOf("-s") + 2)).toEqual(["-s", "danger-full-access"]);
    expect(args).not.toContain("--dangerously-bypass-approvals-and-sandbox");
    expect(args).not.toContain("workspace-write");
  });

  it("garde l'approbation désactivée et le modèle imposé", () => {
    expect(args).toContain('approval_policy="never"');
    expect(args[args.indexOf("-m") + 1]).toBe("gpt-6-luna");
    expect(args).not.toContain("sandbox_workspace_write.network_access=false");
  });
});

describe("parseEffort", () => {
  it.each(["low", "medium", "high", "xhigh", "max"])("accepte %s", (value) => {
    expect(parseEffort(value)).toBe(value);
  });

  it("refuse un effort inconnu par une erreur d'usage", () => {
    expect(() => parseEffort("none")).toThrow(UsageError);
    expect(() => parseEffort("")).toThrow(UsageError);
  });
});

describe("safeEnv", () => {
  const source: NodeJS.ProcessEnv = {
    NODE_ENV: "development",
    Path: "C:\\Windows",
    USERPROFILE: "C:\\Users\\me",
    LOCALAPPDATA: "C:\\Users\\me\\AppData\\Local",
    DATABASE_URL: "postgres://secret",
    AUTH_SECRET: "secret",
    AUTH_GITHUB_ID: "id",
    AUTH_GITHUB_SECRET: "secret",
    OPENAI_API_KEY: "sk-secret",
  };

  it("exclut DATABASE_URL, les AUTH_* et les clés d'API", () => {
    const env = safeEnv(source);
    expect(env.DATABASE_URL).toBeUndefined();
    expect(env.AUTH_SECRET).toBeUndefined();
    expect(env.AUTH_GITHUB_ID).toBeUndefined();
    expect(env.AUTH_GITHUB_SECRET).toBeUndefined();
    expect(env.OPENAI_API_KEY).toBeUndefined();
  });

  it("garde le nécessaire, en ignorant la casse comme Windows", () => {
    const env = safeEnv({ ...source, userprofile: "C:\\Users\\other" });
    expect(env.Path).toBe("C:\\Windows");
    expect(env.USERPROFILE).toBe("C:\\Users\\me");
    expect(env.userprofile).toBe("C:\\Users\\other");
    expect(env.LOCALAPPDATA).toBeDefined();
  });

  it("transmet CODEX_HOME s'il est défini", () => {
    expect(safeEnv({ ...source, CODEX_HOME: "D:\\codex" }).CODEX_HOME).toBe("D:\\codex");
    expect(safeEnv(source).CODEX_HOME).toBeUndefined();
  });

  it("ne transmet ni DATABASE_URL ni AUTH_* par défaut, même vers une base locale", () => {
    const local = { ...source, DATABASE_URL: "postgres://typio:pw@localhost:5433/typio" };
    expect(safeEnv(local).DATABASE_URL).toBeUndefined();
    expect(safeEnv(local, { localDatabase: false }).DATABASE_URL).toBeUndefined();
    expect(safeEnv(local).AUTH_SECRET).toBeUndefined();
  });

  it("en sortie du bac à sable, transmet DATABASE_URL seulement si elle vise la machine locale", () => {
    const local = "postgres://typio:pw@localhost:5433/typio";
    expect(safeEnv({ ...source, DATABASE_URL: local }, { localDatabase: true }).DATABASE_URL).toBe(local);
    expect(safeEnv({ ...source, database_url: local }, { localDatabase: true }).database_url).toBe(local);
    expect(safeEnv(source, { localDatabase: true }).DATABASE_URL).toBeUndefined();
    expect(safeEnv({ ...source, DATABASE_URL: "postgres://u:p@db.example.com/typio" }, { localDatabase: true }).DATABASE_URL).toBeUndefined();
  });

  it("en sortie du bac à sable, garde les secrets AUTH_* et les clés d'API dehors", () => {
    const env = safeEnv({ ...source, DATABASE_URL: "postgres://typio:pw@127.0.0.1/typio" }, { localDatabase: true });
    expect(env.AUTH_SECRET).toBeUndefined();
    expect(env.AUTH_GITHUB_ID).toBeUndefined();
    expect(env.AUTH_GITHUB_SECRET).toBeUndefined();
    expect(env.OPENAI_API_KEY).toBeUndefined();
  });
});

describe("isLocalDatabaseUrl", () => {
  it.each([
    "postgres://u:p@localhost:5433/typio",
    "postgresql://u:p@127.0.0.1:5432/typio",
    "postgres://u:p@[::1]:5432/typio",
    "postgres://u:p@LOCALHOST/typio",
  ])("accepte %s", (url) => {
    expect(isLocalDatabaseUrl(url)).toBe(true);
  });

  it.each([
    undefined,
    "",
    "pas une url",
    "postgres://u:p@db.example.com:5432/typio",
    "postgres://u:p@localhost.evil.com/typio",
    "postgres://localhost:pw@evil.com/typio",
    "postgres://u:p@10.0.0.4/typio",
    "postgres://u:p@localhost/typio?host=evil.com",
    "postgres://u:p@localhost/typio?hostaddr=10.0.0.4",
    "postgres://u@attacker.example,localhost@localhost/db",
    "postgres://u:p@attacker.example:5432,x@localhost:5433/db",
    "postgres://localhost,attacker.example/db",
    "postgres://a@b@localhost/db",
    "postgres://u:p@localhost#,evil.example:5432/db",
    "postgres://u:p@localhost/db#frag",
    "postgres://u:p@localhost/db?sslmode=%72equire",
    "postgres://u:p%40x@localhost/db",
    "postgres://u:p@localhost\\@evil.example/db",
    "postgres://evil.example\\@localhost/db",
  ])("refuse %s", (url) => {
    expect(isLocalDatabaseUrl(url)).toBe(false);
  });
});

describe("describeFailure", () => {
  const run: CodexRun = { stdout: "", stderr: "", exitCode: 1, timedOut: false, missing: false };
  const noEvents = { usage: null, errors: [], commands: [] };

  it("préfère l'erreur rapportée par Codex à la sortie d'erreur", () => {
    expect(describeFailure({ ...run, stderr: "bruit" }, { ...noEvents, errors: ["quota atteint"] }, "")).toBe("réponse vide, quota atteint");
  });

  it("extrait le message d'une erreur d'API rapportée en JSON", () => {
    const api = '{"type":"error","status":400,"error":{"type":"invalid_request_error","message":"modèle refusé"}}';
    expect(describeFailure(run, { ...noEvents, errors: [api] }, "")).toBe("réponse vide, modèle refusé");
    expect(describeFailure(run, { ...noEvents, errors: ['{"message":"direct"}'] }, "")).toBe("réponse vide, direct");
    expect(describeFailure(run, { ...noEvents, errors: ["{pas du json"] }, "")).toBe("réponse vide, {pas du json");
  });

  it("distingue le délai, la réponse vide et l'échec", () => {
    expect(describeFailure({ ...run, timedOut: true, exitCode: null }, noEvents, "")).toBe("délai dépassé, code null");
    expect(describeFailure({ ...run, exitCode: 0 }, noEvents, "")).toBe("réponse vide, code 0");
    expect(describeFailure(run, noEvents, "texte")).toBe("échec, code 1");
  });
});

describe("resolveCodexBinary", () => {
  const dir = path.join("tools", "bin");
  const onPath = path.join(dir, "codex.exe");
  const desktopOld = path.join("local", "OpenAI", "Codex", "bin", "old", "codex.exe");
  const desktopNew = path.join("local", "OpenAI", "Codex", "bin", "new", "codex.exe");

  function lookup(env: Record<string, string>, existing: string[]): BinaryLookup {
    return {
      env: { NODE_ENV: "test", ...env },
      platform: "win32",
      exists: (file) => existing.includes(file),
      desktopCandidates: () => [
        { file: desktopOld, mtimeMs: 1 },
        { file: desktopNew, mtimeMs: 2 },
      ],
    };
  }

  it("préfère CODEX_BIN au PATH et à l'app desktop", () => {
    const explicit = path.join("custom", "codex.exe");
    const env = { CODEX_BIN: explicit, PATH: dir, LOCALAPPDATA: "local" };
    expect(resolveCodexBinary(lookup(env, [explicit, onPath]))).toBe(explicit);
  });

  it("ne se rabat pas sur autre chose quand CODEX_BIN est faux", () => {
    const env = { CODEX_BIN: path.join("nope", "codex.exe"), PATH: dir, LOCALAPPDATA: "local" };
    expect(resolveCodexBinary(lookup(env, [onPath]))).toBeNull();
  });

  it("prend le PATH avant l'app desktop, et lit Path quelle que soit la casse", () => {
    const env = { Path: ["elsewhere", dir].join(path.delimiter), LOCALAPPDATA: "local" };
    expect(resolveCodexBinary(lookup(env, [onPath]))).toBe(onPath);
  });

  it("prend le codex.exe desktop le plus récent à défaut", () => {
    const env = { PATH: dir, LOCALAPPDATA: "local" };
    expect(resolveCodexBinary(lookup(env, []))).toBe(desktopNew);
  });

  it("renvoie null quand rien n'est trouvé", () => {
    expect(resolveCodexBinary({ ...lookup({}, []), desktopCandidates: () => [] })).toBeNull();
    expect(resolveCodexBinary(lookup({ PATH: dir }, []))).toBeNull();
  });
});

describe("isSensitivePath", () => {
  it.each([".env", ".env.local", ".env.production", "apps/web/.env.local", "server.pem", "tls.key", "id_rsa", "id_rsa.pub", "cert.p12", ".git/config", "a\\.git\\HEAD"])(
    "écarte %s",
    (file) => {
      expect(isSensitivePath(file)).toBe(true);
    },
  );

  it.each([".env::$DATA", "tls.key::$DATA", "tls.key.", ".env "])(
    "écarte la forme ambiguë %s (flux NTFS, point ou espace final)",
    (file) => {
      expect(isSensitivePath(file)).toBe(true);
    },
  );

  it.each([".env.example", "src/app/page.tsx", "docs/environment.md", "keyboard.ts", "src/key.ts", ".gitignore", ".github/workflows/ci.yml"])(
    "garde %s",
    (file) => {
      expect(isSensitivePath(file)).toBe(false);
    },
  );
});

describe("parseCodexEvents", () => {
  const jsonl = [
    '{"type":"thread.started","thread_id":"t"}',
    '{"type":"item.completed","item":{"type":"command_execution","command":"Set-Content ecrit.txt","aggregated_output":"Access denied","exit_code":1}}',
    '{"type":"turn.completed","usage":{"input_tokens":100,"cached_input_tokens":50,"output_tokens":7}}',
    "avertissement hors JSON",
    '{"type":"turn.completed","usage":{"input_tokens":10,"output_tokens":3}}',
    '{"type":"error","message":"quota"}',
    '{"type":"turn.failed","error":{"message":"échec"}}',
    "{pas du json",
  ].join("\n");

  it("cumule les jetons des tours terminés", () => {
    expect(parseCodexEvents(jsonl).usage).toEqual({ input: 110, output: 10 });
  });

  it("collecte les erreurs et les commandes", () => {
    const events = parseCodexEvents(jsonl);
    expect(events.errors).toEqual(["quota", "échec"]);
    expect(events.commands).toEqual([{ command: "Set-Content ecrit.txt", exitCode: 1, output: "Access denied" }]);
  });

  it("ne bloque pas sur une sortie inattendue", () => {
    expect(parseCodexEvents("")).toEqual({ usage: null, errors: [], commands: [] });
    expect(parseCodexEvents('{"type":"turn.completed","usage":"?"}\n[1]\nnull').usage).toBeNull();
  });
});

describe("copySnapshot", () => {
  const temps: string[] = [];
  function tempDir(): string {
    const dir = mkdtempSync(path.join(os.tmpdir(), "typio-codex-test-"));
    temps.push(dir);
    return dir;
  }
  function write(root: string, file: string, content = "x"): void {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), content);
  }
  afterEach(() => {
    for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
  });

  it("copie les fichiers ordinaires, saute les sensibles et ignore les supprimés", () => {
    const root = tempDir();
    const dest = tempDir();
    write(root, "src/a.ts", "a");
    write(root, ".env.local", "SECRET");
    write(root, ".env.example", "EXEMPLE");
    write(root, "infra/tls.key", "KEY");
    const result = copySnapshot(root, ["src/a.ts", ".env.local", ".env.example", "infra/tls.key", "supprime.ts"], dest);
    expect(result.copied).toBe(2);
    expect(result.skipped).toEqual([".env.local", "infra/tls.key"]);
    expect(readFileSync(path.join(dest, "src/a.ts"), "utf8")).toBe("a");
    expect(existsSync(path.join(dest, ".env.local"))).toBe(false);
    expect(existsSync(path.join(dest, "infra/tls.key"))).toBe(false);
    expect(existsSync(path.join(dest, "supprime.ts"))).toBe(false);
  });

  it("refuse un fichier atteint par une jonction dans un dossier parent", () => {
    const root = tempDir();
    const outside = tempDir();
    const dest = tempDir();
    write(outside, "secret.txt", "HORS DEPOT");
    // Une jonction ne demande pas de privilège sous Windows ; `dir` est ignoré ailleurs.
    symlinkSync(outside, path.join(root, "lien"), "junction");
    const result = copySnapshot(root, ["lien/secret.txt"], dest);
    expect(result.copied).toBe(0);
    expect(result.skipped).toEqual(["lien/secret.txt"]);
    expect(existsSync(path.join(dest, "lien/secret.txt"))).toBe(false);
  });

  it("refuse un lien symbolique vers un fichier extérieur", (context) => {
    const root = tempDir();
    const outside = tempDir();
    const dest = tempDir();
    write(outside, "secret.txt", "HORS DEPOT");
    try {
      symlinkSync(path.join(outside, "secret.txt"), path.join(root, "lien.txt"), "file");
    } catch {
      context.skip(); // Créer un lien de fichier demande un privilège sous Windows.
    }
    const result = copySnapshot(root, ["lien.txt"], dest);
    expect(result.copied).toBe(0);
    expect(existsSync(path.join(dest, "lien.txt"))).toBe(false);
  });

  it("ne fait rien quand la liste est vide, même si la racine n'existe pas", () => {
    expect(copySnapshot(path.join(os.tmpdir(), "typio-codex-absent"), [], tempDir())).toEqual({ copied: 0, skipped: [] });
  });
});

describe("hasDeniedWrite", () => {
  const denied = {
    command: "powershell.exe -Command 'Set-Content -LiteralPath ecrit.txt -Value TEST'",
    exitCode: 1,
    output: "Set-Content : Access to the path 'ecrit.txt' is denied.",
  };

  it("reconnaît une écriture refusée par le système", () => {
    expect(hasDeniedWrite([denied], "ecrit.txt")).toBe(true);
  });

  it("ne prend pas une lecture en échec pour une écriture refusée", () => {
    const failedRead = { command: "Get-Content ecrit.txt", exitCode: 1, output: "Cannot find path 'ecrit.txt'" };
    expect(hasDeniedWrite([failedRead], "ecrit.txt")).toBe(false);
    expect(hasDeniedWrite([{ ...failedRead, output: "Access denied" }], "ecrit.txt")).toBe(false);
  });

  it("refuse une écriture qui a réussi ou qui échoue pour une autre raison", () => {
    expect(hasDeniedWrite([{ ...denied, exitCode: 0 }], "ecrit.txt")).toBe(false);
    expect(hasDeniedWrite([{ ...denied, output: "Syntax error" }], "ecrit.txt")).toBe(false);
    expect(hasDeniedWrite([denied], "autre.txt")).toBe(false);
  });
});

describe("sensitiveExcludes", () => {
  it("n'exclut du diff que les fichiers sensibles, en pathspec littéral", () => {
    expect(sensitiveExcludes(["src/a.ts", "infra/tls.key", ".env.local", ".env.example"])).toEqual([
      ":(exclude,literal)infra/tls.key",
      ":(exclude,literal).env.local",
    ]);
  });
});

describe("buildPrompt", () => {
  it("rappelle la lecture seule et écarte les consignes d'AGENTS.md", () => {
    const prompt = buildPrompt(TASKS.search, "où est X ?");
    expect(prompt).toContain("lecture seule");
    expect(prompt).toContain("ne s'appliquent pas");
    expect(prompt).toContain("Consigne de l'orchestrateur : où est X ?");
  });

  it("renvoie les tâches à diff vers le fichier de contexte, pas la recherche", () => {
    expect(buildPrompt(TASKS.review, "")).toContain("CODEX_CONTEXT.md");
    expect(buildPrompt(TASKS.search, "q")).not.toContain("Commence par lire le contexte");
  });

  it("règle l'effort et le délai de chaque tâche", () => {
    expect(TASKS.search).toMatchObject({ effort: "low", timeoutMinutes: 4 });
    for (const name of ["review", "tests", "ui"] as const) {
      expect(TASKS[name]).toMatchObject({ effort: "medium", timeoutMinutes: 8 });
    }
  });
});
