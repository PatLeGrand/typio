import path from "node:path";
import { describe, expect, it } from "vitest";
import { decideToolCall } from "./policy";

const win = path.win32;
const roots = ["C:\\repo", "C:\\Temp\\typio-gemini-abc"];
const view = { name: "view_file", args: {} };

describe("decideToolCall", () => {
  it("autorise la lecture d'un fichier du dépôt", () => {
    expect(decideToolCall(view, roots, "C:\\repo\\src\\app\\page.tsx", win)).toEqual({ decision: "allow" });
  });

  it("autorise la lecture du dossier de contexte", () => {
    expect(decideToolCall(view, roots, "C:\\Temp\\typio-gemini-abc\\context.md", win).decision).toBe("allow");
  });

  it("ignore la casse des chemins sous Windows", () => {
    expect(decideToolCall(view, roots, "c:\\REPO\\package.json", win).decision).toBe("allow");
  });

  it.each(["write_to_file", "replace_file_content", "run_command", "read_url_content", "search_web", undefined])(
    "refuse l'outil %s",
    (name) => {
      expect(decideToolCall({ name }, roots, "C:\\repo\\package.json", win).decision).toBe("deny");
    },
  );

  it("refuse un fichier hors des racines, y compris par remontée", () => {
    expect(decideToolCall(view, roots, "C:\\Users\\me\\.ssh\\config", win).decision).toBe("deny");
    expect(decideToolCall(view, roots, "C:\\repo\\..\\other\\file.ts", win).decision).toBe("deny");
    expect(decideToolCall(view, roots, "C:\\repository\\file.ts", win).decision).toBe("deny");
  });

  it.each([".env", ".env.local", ".env.production", "server.pem", "tls.key", "id_rsa"])(
    "refuse le fichier de secrets %s",
    (file) => {
      expect(decideToolCall(view, roots, `C:\\repo\\${file}`, win).decision).toBe("deny");
    },
  );

  it("autorise .env.example, qui est versionné", () => {
    expect(decideToolCall(view, roots, "C:\\repo\\.env.example", win).decision).toBe("allow");
  });

  it.each(["ENV~1.LOC", "ENV~1", "GIT~1\\config", ".env::$DATA", "tls.key::$DATA", "readme.md:secret", "tls.key.", ".env "])(
    "refuse la forme ambiguë %s (nom court, flux NTFS, point ou espace final)",
    (file) => {
      expect(decideToolCall(view, roots, `C:\\repo\\${file}`, win).decision).toBe("deny");
    },
  );

  it("refuse un argument de chemin autre qu'AbsolutePath", () => {
    const call = { name: "view_file", args: { AbsolutePath: "C:\\repo\\a.ts", Other: "C:\\repo\\.env.local" } };
    expect(decideToolCall(call, roots, "C:\\repo\\a.ts", win).decision).toBe("deny");
  });

  it("refuse un chemin caché dans un argument tableau", () => {
    const call = { name: "view_file", args: { AbsolutePath: "C:\\repo\\a.ts", Extra: ["C:\\repo\\.env.local"] } };
    expect(decideToolCall(call, roots, "C:\\repo\\a.ts", win).decision).toBe("deny");
  });

  it("accepte les arguments descriptifs de view_file", () => {
    const call = {
      name: "view_file",
      args: { AbsolutePath: "C:\\repo\\a.ts", toolAction: "Reading a/b", toolSummary: "Read a.ts" },
    };
    expect(decideToolCall(call, roots, "C:\\repo\\a.ts", win).decision).toBe("allow");
  });

  it("refuse le dossier .git", () => {
    expect(decideToolCall(view, roots, "C:\\repo\\.git\\config", win).decision).toBe("deny");
  });

  it("refuse tout quand le chemin ou les racines manquent", () => {
    expect(decideToolCall(view, [], "C:\\repo\\package.json", win).decision).toBe("deny");
    expect(decideToolCall(view, roots, null, win).decision).toBe("deny");
  });

  it("fonctionne avec des chemins POSIX", () => {
    const posix = path.posix;
    expect(decideToolCall(view, ["/repo"], "/repo/src/a.ts", posix).decision).toBe("allow");
    expect(decideToolCall(view, ["/repo"], "/etc/passwd", posix).decision).toBe("deny");
  });
});
