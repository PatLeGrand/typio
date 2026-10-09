import { describe, expect, it } from "vitest";
import { describeExit, TamperedWorkError, UnavailableError, UsageError } from "./errors";

describe("describeExit", () => {
  it("une erreur d'usage donne le code 1 et son message tel quel", () => {
    expect(describeExit(new UsageError("option invalide"))).toEqual({ code: 1, message: "option invalide" });
  });

  it("un Codex indisponible donne le code 2 avec le préfixe CODEX_INDISPONIBLE", () => {
    expect(describeExit(new UnavailableError("quota : seuil atteint"))).toEqual({
      code: 2,
      message: "CODEX_INDISPONIBLE : quota : seuil atteint",
    });
  });

  it("une alerte de sécurité garde son libellé ALERTE et le code 2", () => {
    expect(describeExit(new UnavailableError("ALERTE : Codex a pu écrire hors de son dossier."))).toEqual({
      code: 2,
      message: "ALERTE : Codex a pu écrire hors de son dossier.",
    });
  });

  it("un travail refusé (TamperedWorkError) garde son libellé ALERTE et le code 2", () => {
    const error = new TamperedWorkError("ALERTE : le travail de Codex contient un .gitmodules : .gitmodules.");
    expect(error).toBeInstanceOf(UnavailableError);
    expect(describeExit(error)).toEqual({ code: 2, message: error.message });
  });

  it("toute autre erreur est traitée comme un Codex indisponible", () => {
    expect(describeExit(new Error("git a échoué"))).toEqual({ code: 2, message: "CODEX_INDISPONIBLE : git a échoué" });
    expect(describeExit("texte")).toEqual({ code: 2, message: "CODEX_INDISPONIBLE : texte" });
  });
});
