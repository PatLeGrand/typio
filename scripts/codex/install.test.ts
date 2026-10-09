import { afterEach, describe, expect, it, vi } from "vitest";
import { INSTALL_ARGS, installDependencies } from "./install";
import { UnavailableError } from "./errors";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("installDependencies", () => {
  it("installe par copie, sans toucher au lockfile", () => {
    expect([...INSTALL_ARGS]).toEqual(["install", "--frozen-lockfile", "--backend=copyfile"]);
  });

  it("lance l'installation dans le dossier demandé", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const run = vi.fn(() => ({ status: 0, output: "" }));
    installDependencies("C:\\work\\run-1\\src", run);
    expect(run).toHaveBeenCalledWith("C:\\work\\run-1\\src");
  });

  it("un échec est un Codex indisponible (code 2), avec le code réel et la fin de la sortie", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const output = Array.from({ length: 30 }, (_, index) => `ligne ${index + 1}`).join("\n");
    const failing = () => installDependencies("x", () => ({ status: 1, output }));
    expect(failing).toThrow(UnavailableError);
    expect(failing).toThrow(/code 1/);
    expect(failing).toThrow(/ligne 30/);
    expect(failing).not.toThrow(/ligne 1\n/);
  });

  it("un lancement impossible ou un délai (sans code de sortie) est aussi un échec", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => installDependencies("x", () => ({ status: null, output: "", error: "spawnSync ETIMEDOUT" }))).toThrow(/ETIMEDOUT/);
  });
});
