import { mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { saveProof } from "./canary";

const temps: string[] = [];

function tempDir(prefix = "typio-codex-write-"): string {
  const dir = realpathSync.native(mkdtempSync(path.join(os.tmpdir(), prefix)));
  temps.push(dir);
  return dir;
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
});

// Le déroulé de `runWrite` est testé dans `runWrite.test.ts` (faux Codex, vrais dépôts et worktrees).

describe("saveProof : cache du canari", () => {
  it("écrit la preuve par renommage, sans fichier temporaire restant", () => {
    const dir = tempDir();
    const cache = path.join(dir, "state", "canary.json");
    saveProof(cache, "empreinte");
    expect(JSON.parse(readFileSync(cache, "utf8"))).toMatchObject({ fingerprint: "empreinte" });
    expect(readdirSync(path.dirname(cache))).toEqual(["canary.json"]);
  });

  it("un échec d'écriture avertit sans lever : le canari réussi n'est pas perdu", () => {
    const dir = tempDir();
    // Le « dossier » du cache est un fichier : mkdir et écriture échouent.
    const blocker = path.join(dir, "bloqueur");
    writeFileSync(blocker, "x");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => saveProof(path.join(blocker, "canary.json"), "empreinte")).not.toThrow();
    expect(log).toHaveBeenCalledWith(expect.stringContaining("AVERTISSEMENT"));
    mkdirSync(path.join(dir, "autre"));
  });
});
