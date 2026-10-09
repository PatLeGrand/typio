import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { parseCli, type WriteCommand } from "./cli";
import { UsageError } from "./errors";

function write(argv: string[]): WriteCommand {
  const command = parseCli(argv);
  if (command.kind !== "write") throw new Error("commande d'écriture attendue");
  return command;
}

describe("parseCli : lecture", () => {
  it("lit la tâche, la consigne et les surcharges", () => {
    expect(parseCli(["search", "--model", "gpt-x", "--effort", "high", "où", "est", "X ?"])).toEqual({
      kind: "read",
      task: "search",
      instruction: "où est X ?",
      base: undefined,
      model: "gpt-x",
      effort: "high",
      quotaThreshold: 90,
      keep: false,
    });
  });

  it("lit --seuil-quota, y compris 0", () => {
    expect(parseCli(["search", "--seuil-quota", "0", "x"])).toMatchObject({ quotaThreshold: 0 });
    expect(parseCli(["review", "--seuil-quota", "75.5", "--base", "main"])).toMatchObject({ quotaThreshold: 75.5, base: "main" });
  });

  it.each([
    ["--seuil-quota", "101"],
    ["--seuil-quota", "-1"],
    ["--seuil-quota", "abc"],
    ["--seuil-quota", ""],
    ["--effort", "none"],
  ])("refuse %s %s", (option, value) => {
    expect(() => parseCli(["search", option, value, "x"])).toThrow(UsageError);
  });

  it("search demande une consigne ; review non", () => {
    expect(() => parseCli(["search"])).toThrow(UsageError);
    expect(parseCli(["review"])).toMatchObject({ kind: "read", task: "review", instruction: "" });
  });

  it("refuse les options d'écriture sur une tâche de lecture", () => {
    const options = [
      ["--level", "1"],
      ["--brief", "b.md"],
      ["--from", "HEAD"],
      ["--branch", "codex/x"],
      ["--checks", "lint"],
      ["--sortie-bac-a-sable", "raison"],
    ];
    for (const option of options) {
      expect(() => parseCli(["search", ...option, "x"])).toThrow(UsageError);
    }
  });
});

describe("parseCli : écriture", () => {
  it("implement : lit le niveau, le brief et les valeurs par défaut", () => {
    expect(write(["implement", "--level", "2", "--brief", "brief.md"])).toEqual({
      kind: "write",
      task: "implement",
      level: 2,
      briefPath: "brief.md",
      from: "HEAD",
      branch: undefined,
      checks: ["lint"],
      sandboxExitReason: undefined,
      model: undefined,
      effort: undefined,
      quotaThreshold: 90,
      keep: false,
    });
  });

  it("lit --from, --branch, --checks et les surcharges", () => {
    const command = write([
      "implement", "--level", "4", "--brief", "b.md", "--from", "origin/develop", "--branch", "codex/mon-test",
      "--checks", "lint", "--model", "gpt-x", "--effort", "xhigh", "--keep",
    ]);
    expect(command).toMatchObject({
      level: 4,
      from: "origin/develop",
      branch: "codex/mon-test",
      checks: ["lint"],
      model: "gpt-x",
      effort: "xhigh",
      keep: true,
    });
  });

  it("qa : sans niveau", () => {
    expect(write(["qa", "--brief", "b.md"])).toMatchObject({ task: "qa", level: undefined });
    expect(() => parseCli(["qa", "--brief", "b.md", "--level", "1"])).toThrow(UsageError);
  });

  it("--level 3 est une erreur d'usage qui renvoie vers Sonnet", () => {
    expect(() => parseCli(["implement", "--level", "3", "--brief", "b.md"])).toThrow(UsageError);
    expect(() => parseCli(["implement", "--level", "3", "--brief", "b.md"])).toThrow("c'est Sonnet, côté Claude");
  });

  it.each([
    [["implement", "--brief", "b.md"]],
    [["implement", "--level", "1"]],
    [["qa"]],
    [["implement", "--level", "9", "--brief", "b.md"]],
  ])("refuse %j", (argv) => {
    expect(() => parseCli(argv)).toThrow(UsageError);
  });

  it("refuse une consigne en argument et --base", () => {
    expect(() => parseCli(["qa", "--brief", "b.md", "une consigne"])).toThrow(UsageError);
    expect(() => parseCli(["qa", "--brief", "b.md", "--base", "main"])).toThrow(UsageError);
  });

  it("refuse une branche hors codex/* ou invalide", () => {
    for (const branch of ["main", "feat/x", "codex/", "codex/../x", "codex/a b"]) {
      expect(() => parseCli(["qa", "--brief", "b.md", "--branch", branch])).toThrow(UsageError);
    }
  });

  it("--checks : liste, none, ou erreur", () => {
    expect(write(["qa", "--brief", "b.md", "--checks", "none"]).checks).toEqual([]);
    expect(write(["qa", "--brief", "b.md", "--checks", "lint"]).checks).toEqual(["lint"]);
    expect(write(["qa", "--brief", "b.md"]).checks).toEqual(["lint"]);
    // Hors bac à sable levé, seuls lint et none tournent automatiquement : le reste va à verify.
    for (const value of ["test", "build", "lint,test", "lint,test,build", "lint;rm", ""]) {
      expect(() => parseCli(["qa", "--brief", "b.md", "--checks", value])).toThrow(UsageError);
    }
    expect(() => parseCli(["qa", "--brief", "b.md", "--checks", "test"])).toThrow(/verify/);
    // Bac à sable levé : tout tourne hors bac à sable, la liste est libre.
    expect(write(["qa", "--brief", "b.md", "--sortie-bac-a-sable", "base", "--checks", "lint,build"]).checks).toEqual(["lint", "build"]);
    expect(write(["qa", "--brief", "b.md", "--sortie-bac-a-sable", "base"]).checks).toEqual(["lint", "test", "build"]);
    expect(() => parseCli(["qa", "--brief", "b.md", "--sortie-bac-a-sable", "base", "--checks", "lint;rm"])).toThrow(UsageError);
  });
});

describe("parseCli : sortie du bac à sable", () => {
  it("garde la raison", () => {
    const command = write(["implement", "--level", "1", "--brief", "b.md", "--sortie-bac-a-sable", "  base locale  "]);
    expect(command.sandboxExitReason).toBe("base locale");
  });

  it.each([[""], ["   "]])("refuse une raison vide (%j)", (reason) => {
    expect(() => parseCli(["implement", "--level", "1", "--brief", "b.md", "--sortie-bac-a-sable", reason])).toThrow(UsageError);
  });

  it("refuse l'option sans valeur", () => {
    expect(() => parseCli(["implement", "--level", "1", "--brief", "b.md", "--sortie-bac-a-sable"])).toThrow(UsageError);
  });
});

describe("parseCli : options bornées", () => {
  it.each([
    [["search", "--base=-x", "q"]],
    [["review", "--base=--all"]],
    [["qa", "--brief", "b.md", "--from=-x"]],
    [["qa", "--brief", "b.md", "--from=--all"]],
    [["qa", "--brief", "b.md", "--branch=-x"]],
  ])("refuse une valeur qui commence par un tiret : %j", (argv) => {
    expect(() => parseCli(argv)).toThrow(UsageError);
    expect(() => parseCli(argv)).toThrow(/« - »|commence par/);
  });

  it.each(["gpt-6-luna", "gpt-5.6-terra", "gpt-6.1-sol", "a", "A_b-c.1"])("accepte le modèle %s", (model) => {
    expect(parseCli(["search", "--model", model, "q"])).toMatchObject({ model });
  });

  it.each(["-x", "--bad", ".model", "_x", "a b", "a;b", "a/b", "a$(x)", "gpté"])("refuse le modèle %j", (model) => {
    expect(() => parseCli(["search", `--model=${model}`, "q"])).toThrow(UsageError);
  });

  it.each([".env", ".env.local", "secret.pem", "id_rsa", "tls.key"])("refuse le brief sensible %s", (name) => {
    expect(() => parseCli(["qa", "--brief", name])).toThrow(UsageError);
    expect(() => parseCli(["qa", "--brief", `dossier/${name}`])).toThrow(UsageError);
  });

  it("accepte un brief ordinaire, y compris .env.example", () => {
    expect(write(["qa", "--brief", "docs/brief.md"]).briefPath).toBe("docs/brief.md");
    expect(write(["qa", "--brief", ".env.example"]).briefPath).toBe(".env.example");
  });
});

describe("parseCli : clean et usage", () => {
  it("clean accepte une branche codex/*", () => {
    expect(parseCli(["clean", "codex/implement-20261008-120000"])).toEqual({ kind: "clean", branch: "codex/implement-20261008-120000" });
  });

  it.each([
    [["clean", "main"]],
    [["clean", "develop"]],
    [["clean"]],
    [["clean", "codex/a", "codex/b"]],
    [["clean", "codex/a", "--keep"]],
  ])("refuse %j", (argv) => {
    expect(() => parseCli(argv)).toThrow(UsageError);
  });

  it("tâche inconnue, option inconnue ou rien : erreur d'usage", () => {
    expect(() => parseCli([])).toThrow(UsageError);
    expect(() => parseCli(["inconnue", "x"])).toThrow(UsageError);
    expect(() => parseCli(["constructor", "x"])).toThrow(UsageError);
    expect(() => parseCli(["search", "--inconnue", "x"])).toThrow(UsageError);
  });
});

describe("parseCli : clean --work", () => {
  it("lit l'identifiant d'un dossier work", () => {
    expect(parseCli(["clean", "--work", "run-AbC123"])).toEqual({ kind: "cleanWork", id: "run-AbC123" });
  });

  it.each([
    [["clean", "--work", "../x"]],
    [["clean", "--work", "a/b"]],
    [["clean", "--work", "a\\b"]],
    [["clean", "--work", ".."]],
    [["clean", "--work", ""]],
    [["clean", "--work", "-x"]],
    [["clean", "--work", "run-1", "codex/a"]],
    [["clean", "--work", "run-1", "--keep"]],
    [["clean", "--work", "run-1", "--brief", "b.md"]],
    [["clean", "--work"]],
  ])("refuse %j", (argv) => {
    expect(() => parseCli(argv)).toThrow(UsageError);
  });

  it("--work ne concerne que clean", () => {
    for (const argv of [
      ["verify", "codex/a", "--work", "run-1"],
      ["search", "--work", "run-1", "x"],
      ["qa", "--brief", "b.md", "--work", "run-1"],
    ]) {
      expect(() => parseCli(argv)).toThrow(UsageError);
    }
  });
});

describe("parseCli : --brief et chemin réel", () => {
  const temps: string[] = [];
  afterEach(() => {
    for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
  });
  const tempDir = (): string => {
    const dir = realpathSync.native(mkdtempSync(path.join(os.tmpdir(), "typio-codex-brief-")));
    temps.push(dir);
    return dir;
  };

  it.each([".env/brief.md", ".env.local/x/brief.md", "a/.git/brief.md", "cles/id_rsa/brief.md", "a/tls.pem/b.md"])(
    "refuse un brief dont un segment est sensible : %s",
    (brief) => {
      expect(() => parseCli(["qa", "--brief", brief])).toThrow(UsageError);
      expect(() => parseCli(["qa", "--brief", brief])).toThrow(/secret/);
    },
  );

  it("refuse un brief existant dans un dossier .env, par chemin absolu", () => {
    const dir = path.join(tempDir(), ".env");
    mkdirSync(dir);
    writeFileSync(path.join(dir, "brief.md"), "# brief\n");
    expect(() => parseCli(["qa", "--brief", path.join(dir, "brief.md")])).toThrow(UsageError);
  });

  it("refuse un brief atteint par un lien vers un dossier .env (chemin réel)", () => {
    const root = tempDir();
    const secret = path.join(root, ".env");
    mkdirSync(secret);
    writeFileSync(path.join(secret, "brief.md"), "# brief\n");
    const link = path.join(root, "innocent");
    symlinkSync(secret, link, "junction");
    expect(() => parseCli(["qa", "--brief", path.join(link, "brief.md")])).toThrow(UsageError);
  });

  it("accepte un brief ordinaire existant", () => {
    const dir = tempDir();
    writeFileSync(path.join(dir, "brief.md"), "# brief\n");
    expect(write(["qa", "--brief", path.join(dir, "brief.md")]).briefPath).toBe(path.join(dir, "brief.md"));
  });
});
