import { describe, expect, it } from "vitest";
import { UsageError } from "./errors";
import { buildWritePrompt, IMPLEMENT_PROFILES, parseLevel, QA_PROFILE, resolveWriteProfile, TASKS } from "./tasks";

describe("modèle, effort et délai par tâche", () => {
  it("lecture : search en gpt-6-luna/low (4 min), review, tests et ui en gpt-5.6-terra/medium (8 min)", () => {
    expect(TASKS.search).toMatchObject({ model: "gpt-6-luna", effort: "low", timeoutMinutes: 4 });
    for (const name of ["review", "tests", "ui"] as const) {
      expect(TASKS[name]).toMatchObject({ model: "gpt-5.6-terra", effort: "medium", timeoutMinutes: 8 });
    }
  });

  it("implement : niveaux 1, 2 et 4", () => {
    expect(resolveWriteProfile("implement", 1)).toEqual({ model: "gpt-6-luna", effort: "medium", timeoutMinutes: 15 });
    expect(resolveWriteProfile("implement", 2)).toEqual({ model: "gpt-5.6-terra", effort: "medium", timeoutMinutes: 30 });
    expect(resolveWriteProfile("implement", 4)).toEqual({ model: "gpt-6.1-sol", effort: "medium", timeoutMinutes: 30 });
    expect(Object.keys(IMPLEMENT_PROFILES)).toEqual(["1", "2", "4"]);
  });

  it("qa : gpt-5.6-terra/medium (30 min), sans niveau", () => {
    expect(resolveWriteProfile("qa", undefined)).toEqual({ model: "gpt-5.6-terra", effort: "medium", timeoutMinutes: 30 });
    expect(QA_PROFILE.timeoutMinutes).toBe(30);
  });

  it("implement sans niveau est une erreur d'usage", () => {
    expect(() => resolveWriteProfile("implement", undefined)).toThrow(UsageError);
  });
});

describe("parseLevel", () => {
  it.each([
    ["1", 1],
    ["2", 2],
    ["4", 4],
  ])("lit %s", (value, level) => {
    expect(parseLevel(value)).toBe(level);
  });

  it("explique que le niveau 3 est Sonnet, côté Claude", () => {
    expect(() => parseLevel("3")).toThrow(UsageError);
    expect(() => parseLevel("3")).toThrow("Le niveau 3 n'existe pas dans le wrapper : c'est Sonnet, côté Claude.");
  });

  it.each([undefined, "0", "5", "deux", ""])("refuse %s", (value) => {
    expect(() => parseLevel(value)).toThrow(UsageError);
  });
});

describe("buildWritePrompt", () => {
  const brief = "# Brief\n\nCrée docs/codex-smoke.md.\n- AC-1 : le fichier existe.\n";

  it("inclut le brief tel quel, le rôle et le niveau", () => {
    const prompt = buildWritePrompt({ task: "implement", level: 2, brief });
    expect(prompt).toContain(brief);
    expect(prompt).toContain("exécutant de l'orchestrateur Claude");
    expect(prompt).toContain("implement, niveau 2");
  });

  it("impose les skills, le périmètre et l'interdiction de git", () => {
    const prompt = buildWritePrompt({ task: "implement", level: 1, brief });
    expect(prompt).toContain(".agents/skills/code-quality/SKILL.md");
    expect(prompt).toContain(".agents/skills/qa/SKILL.md");
    for (const forbidden of ["git commit", "push", "checkout", "branch", "stash", "reset", "worktree"]) {
      expect(prompt).toContain(forbidden);
    }
    for (const protectedPath of ["CLAUDE.md", "AGENTS.md", ".claude/**", ".agents/**", "scripts/codex/**", "scripts/gemini/**"]) {
      expect(prompt).toContain(protectedPath);
    }
    expect(prompt).toContain("src/realtime/protocol.ts");
    expect(prompt).toContain("Ne lis rien hors de ton dossier de travail, en particulier aucun fichier `.env*` ni aucun dossier `~/.codex`.");
    expect(prompt).toContain("français et en anglais");
    expect(prompt).toContain("arrête-toi et signale-la");
  });

  it("dit que le dossier de travail est une copie sans git et interdit ce que le wrapper refuse ensuite", () => {
    const prompt = buildWritePrompt({ task: "implement", level: 1, brief });
    expect(prompt).toContain("copie du dépôt");
    expect(prompt).toContain("sans historique git");
    expect(prompt).not.toContain("worktree git");
    for (const forbidden of ["`.git`", "`.gitmodules`", "lien symbolique", "`.codex`", "`.env*`"]) {
      expect(prompt).toContain(forbidden);
    }
  });

  it("niveau 1 signale node_modules absent et le niveau 2 les dépendances installées", () => {
    const prompt = buildWritePrompt({ task: "implement", level: 1, brief });
    expect(prompt).toContain("node_modules absent");
    expect(prompt).not.toContain("dépendances installées");
    expect(prompt).toContain("ne lance ni lint, ni tsc, ni tests");
    const levelTwo = buildWritePrompt({ task: "implement", level: 2, brief });
    expect(levelTwo).toContain("dépendances installées");
    expect(levelTwo).not.toContain("node_modules absent");
  });

  it("qa demande les tests manquants et le rapport fidèle des échecs", () => {
    const prompt = buildWritePrompt({ task: "qa", brief });
    expect(prompt).toContain("Tâche : qa");
    expect(prompt).toContain("écris les tests manquants");
    expect(prompt).toContain("rapporte fidèlement chaque échec");
    expect(buildWritePrompt({ task: "implement", level: 1, brief })).not.toContain("rapporte fidèlement chaque échec");
  });

  it("n'annonce la levée du bac à sable que si elle est demandée", () => {
    expect(buildWritePrompt({ task: "implement", level: 1, brief })).not.toContain("levé exceptionnellement");
    const prompt = buildWritePrompt({ task: "implement", level: 1, brief, sandboxExitReason: "base locale" });
    expect(prompt).toContain("levé exceptionnellement");
    expect(prompt).toContain("base locale");
  });
});
