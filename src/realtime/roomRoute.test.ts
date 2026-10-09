import { describe, expect, it } from "vitest";
import { parseJoinRole, roomPath } from "./roomRoute";

describe("parseJoinRole", () => {
  it("accepte coureur et spectateur", () => {
    expect(parseJoinRole("runner")).toBe("runner");
    expect(parseJoinRole("spectator")).toBe("spectator");
  });

  it.each([undefined, "", "host", "SPECTATOR", ["spectator"], 42, null])("%j retombe sur coureur", (value) => {
    expect(parseJoinRole(value)).toBe("runner");
  });
});

describe("roomPath", () => {
  it("construit le chemin de la salle dans la langue courante", () => {
    expect(roomPath("fr", "ABC234")).toBe("/fr/room/ABC234");
    expect(roomPath("en", "ABC234", "runner")).toBe("/en/room/ABC234");
  });

  it("ajoute le rôle seulement pour un spectateur", () => {
    expect(roomPath("fr", "ABC234", "spectator")).toBe("/fr/room/ABC234?role=spectator");
  });
});
