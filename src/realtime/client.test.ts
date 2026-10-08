import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ io: vi.fn(() => ({ connect: vi.fn() })) }));
vi.mock("socket.io-client", () => ({ io: mocks.io }));

import { getSocket } from "./client";

describe("getSocket (navigateur)", () => {
  beforeEach(() => mocks.io.mockClear());

  it("ne crée aucun socket à l'import", () => {
    expect(mocks.io).not.toHaveBeenCalled();
  });

  it("crée le socket à la première demande, sans connexion automatique, et le réutilise", () => {
    const first = getSocket();
    const second = getSocket();

    expect(first).not.toBeNull();
    expect(second).toBe(first);
    expect(mocks.io).toHaveBeenCalledTimes(1);
    expect(mocks.io).toHaveBeenCalledWith(undefined, { withCredentials: true, autoConnect: false });
  });
});
