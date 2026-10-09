import { describe, expect, it } from "vitest";
import {
  buildNoChangeReport,
  buildWriteReport,
  formatFooter,
  formatIgnored,
  formatPriority,
  priorityReviewFiles,
  sandboxExitBanner,
  type WriteReport,
} from "./report";

const report: WriteReport = {
  lastMessage: "Fichiers modifiés : docs/codex-smoke.md",
  checks: "- bun run lint : code 0, 5 s\nVERIFICATIONS : OK",
  status: "?? docs/codex-smoke.md\n",
  diffStat: " docs/codex-smoke.md | 1 +\n",
  worktreePath: "C:\\repo\\.claude\\worktrees\\codex-implement-1",
  branch: "codex/implement-1",
  footer: "Codex gpt-6-luna/medium · bac à sable workspace-write, réseau coupé · 120 tokens · 40 s",
};

describe("formatFooter", () => {
  const base = { model: "gpt-6-luna", effort: "low", sandbox: "read-only", usage: { input: 100, output: 20 }, seconds: 31 } as const;

  it("indique modèle/effort, bac à sable, jetons et durée", () => {
    expect(formatFooter(base)).toBe("Codex gpt-6-luna/low · bac à sable lecture seule · 120 tokens · 31 s");
  });

  it("omet les jetons quand Codex ne les rapporte pas", () => {
    expect(formatFooter({ ...base, usage: null })).not.toContain("tokens");
  });

  it("signale les fichiers écartés de la copie de lecture, et seulement s'il y en a", () => {
    expect(formatFooter({ ...base, skippedFiles: 3 })).toContain("3 fichier(s) écarté(s) de la copie");
    expect(formatFooter({ ...base, skippedFiles: 0 })).not.toContain("écarté");
    expect(formatFooter(base)).not.toContain("écarté");
  });

  it("nomme la sortie du bac à sable et sa raison", () => {
    const footer = formatFooter({ ...base, sandbox: "danger-full-access", sandboxExitReason: "base locale" });
    expect(footer).toContain("SORTIE DU BAC À SABLE");
    expect(footer).toContain("base locale");
  });
});

describe("buildWriteReport", () => {
  it("ordonne : dernier message, vérifications, modifications, worktree, pied", () => {
    const text = buildWriteReport(report);
    const positions = [
      text.indexOf(report.lastMessage),
      text.indexOf("## Vérifications (lancées par le wrapper)"),
      text.indexOf("?? docs/codex-smoke.md"),
      text.indexOf("docs/codex-smoke.md | 1 +"),
      text.indexOf("Chemin : C:\\repo"),
      text.indexOf("Branche : codex/implement-1"),
      text.indexOf(report.footer),
    ];
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(text).toContain("VERIFICATIONS : OK");
    expect(text).toContain("clean codex/implement-1");
  });

  it("sans sortie du bac à sable, aucun bandeau", () => {
    expect(buildWriteReport(report)).not.toContain("ATTENTION");
  });

  it("avec sortie du bac à sable, le bandeau ouvre et ferme le rapport", () => {
    const text = buildWriteReport({ ...report, sandboxExitReason: "base locale" });
    const banner = sandboxExitBanner("base locale");
    expect(text.startsWith(banner)).toBe(true);
    expect(text.trimEnd().endsWith(banner)).toBe(true);
    expect(banner).toContain("Canari d'écriture sauté");
  });

  it("dit quand il n'y a aucun changement", () => {
    const text = buildWriteReport({ ...report, status: "", diffStat: "" });
    expect(text).toContain("(aucun changement)");
    expect(text).toContain("(aucun diff)");
  });
});

describe("fichiers ignorés dans le rapport", () => {
  it("formatIgnored : rien à dire sans fichier ignoré", () => {
    expect(formatIgnored([])).toBeNull();
  });

  it("liste les fichiers ignorés, au plus 30 lignes, avec le reste compté", () => {
    const ignored = Array.from({ length: 45 }, (_, index) => `dist/f${index + 1}.js`);
    const text = formatIgnored(ignored) ?? "";
    expect(text).toContain("non reportés");
    expect(text).toContain("dist/f1.js");
    expect(text).toContain("dist/f30.js");
    expect(text).not.toContain("dist/f31.js");
    expect(text).toContain("(+15 autres)");
    expect(formatIgnored(ignored.slice(0, 30))).not.toContain("autres");
  });

  it("le rapport d'écriture montre les fichiers ignorés avant la section worktree", () => {
    const text = buildWriteReport({ ...report, ignored: ["dist/x.js", "debug.log"] });
    expect(text.indexOf("dist/x.js")).toBeGreaterThan(text.indexOf("## Modifications du worktree"));
    expect(text.indexOf("dist/x.js")).toBeLessThan(text.indexOf("## Worktree"));
    expect(buildWriteReport(report)).not.toContain("non reportés");
  });
});

describe("buildNoChangeReport", () => {
  const noChange = {
    lastMessage: "Rien à faire.",
    checks: "VERIFICATIONS (bac à sable) : lint OK",
    footer: "Codex gpt-6-luna/medium · bac à sable workspace-write, réseau coupé · 40 s",
  };

  it("dit qu'il n'y a ni worktree ni branche, et ne propose aucun clean", () => {
    const text = buildNoChangeReport(noChange);
    expect(text).toContain("Rien à faire.");
    expect(text).toContain("VERIFICATIONS (bac à sable) : lint OK");
    expect(text).toContain("Aucun changement");
    expect(text).toContain("Aucun worktree ni aucune branche");
    expect(text).not.toContain("clean codex/");
    expect(text.trimEnd().endsWith(noChange.footer)).toBe(true);
  });

  it("liste quand même les fichiers ignorés créés, et porte le bandeau de sortie du bac à sable", () => {
    const text = buildNoChangeReport({ ...noChange, ignored: ["dist/x.js"], sandboxExitReason: "base locale" });
    expect(text).toContain("dist/x.js");
    expect(text.startsWith(sandboxExitBanner("base locale"))).toBe(true);
  });
});

describe("priorityReviewFiles : à relire en priorité", () => {
  const none = { added: [], modified: [], deleted: [] };

  it.each([".gitattributes", ".gitignore", ".lfsconfig", "bunfig.toml", ".npmrc", "bun.lock", "package.json"])("repère %s, à la racine et en profondeur", (name) => {
    expect(priorityReviewFiles({ ...none, modified: [name] })).toEqual([`${name} (modifié)`]);
    expect(priorityReviewFiles({ ...none, added: [`sous/dossier/${name}`] })).toEqual([`sous/dossier/${name} (ajouté)`]);
    expect(priorityReviewFiles({ ...none, deleted: [name] })).toEqual([`${name} (supprimé)`]);
  });

  it("repère tout ce qui est sous .github/", () => {
    expect(priorityReviewFiles({ ...none, added: [".github/workflows/ci.yml", ".github/CODEOWNERS"] })).toEqual([
      ".github/CODEOWNERS (ajouté)",
      ".github/workflows/ci.yml (ajouté)",
    ]);
  });

  it("ne repère ni un fichier ordinaire, ni un nom qui n'en est que proche", () => {
    expect(
      priorityReviewFiles({ ...none, added: ["src/a.ts", "docs/package.json.md", "mon-package.json", "x/.github-notes.md", "github/ci.yml", "docs/.github/x.md"] }),
    ).toEqual([]);
  });

  it("formatPriority : un bloc en tête, absent s'il n'y a rien", () => {
    expect(formatPriority([])).toBeNull();
    expect(formatPriority(["package.json (modifié)"])).toBe("A RELIRE EN PRIORITÉ :\n- package.json (modifié)");
  });

  it("le rapport commence par ce bloc (après le bandeau de sortie du bac à sable s'il y en a un)", () => {
    const text = buildWriteReport({ ...report, priority: ["package.json (modifié)"] });
    expect(text.startsWith("A RELIRE EN PRIORITÉ :")).toBe(true);
    const banner = sandboxExitBanner("base locale");
    const withBanner = buildWriteReport({ ...report, priority: ["package.json (modifié)"], sandboxExitReason: "base locale" });
    expect(withBanner.startsWith(banner)).toBe(true);
    expect(withBanner.indexOf("A RELIRE")).toBeLessThan(withBanner.indexOf(report.lastMessage));
    expect(buildWriteReport(report)).not.toContain("A RELIRE");
  });
});

describe("invalidation des canaris dans le rapport", () => {
  it("le dit quand les caches ont été supprimés, et seulement alors", () => {
    expect(buildWriteReport({ ...report, canariesReset: true })).toContain("state/canary-*.json");
    expect(buildNoChangeReport({ lastMessage: "x", checks: "y", footer: "z", canariesReset: true })).toContain("state/canary-*.json");
    expect(buildWriteReport(report)).not.toContain("canary-*.json");
  });
});

