import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ syncRoomUser: vi.fn() }));
vi.mock("./useRoom", () => ({ syncRoomUser: mocks.syncRoomUser }));

import { RoomSessionGuard } from "./RoomSessionGuard";

beforeEach(() => vi.clearAllMocks());

describe("RoomSessionGuard", () => {
  it("transmet l'utilisateur courant au store, et null quand il n'y en a plus (déconnexion)", () => {
    const { rerender } = render(<RoomSessionGuard userId="u1" />);
    expect(mocks.syncRoomUser).toHaveBeenLastCalledWith("u1");

    rerender(<RoomSessionGuard userId={null} />);
    expect(mocks.syncRoomUser).toHaveBeenLastCalledWith(null);
  });

  it("transmet aussi un changement d'utilisateur", () => {
    const { rerender } = render(<RoomSessionGuard userId="u1" />);
    rerender(<RoomSessionGuard userId="u2" />);
    expect(mocks.syncRoomUser.mock.calls).toEqual([["u1"], ["u2"]]);
  });

  it("ne rend rien", () => {
    const { container } = render(<RoomSessionGuard userId="u1" />);
    expect(container).toBeEmptyDOMElement();
  });
});
