// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ io: vi.fn() }));
vi.mock("socket.io-client", () => ({ io: mocks.io }));

import { getSocket } from "./client";

describe("getSocket (rendu serveur)", () => {
  it("ne crée aucun socket ni à l'import ni à l'appel, hors navigateur", () => {
    expect(mocks.io).not.toHaveBeenCalled();
    expect(getSocket()).toBeNull();
    expect(mocks.io).not.toHaveBeenCalled();
  });
});
