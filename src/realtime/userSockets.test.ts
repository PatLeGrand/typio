import { describe, expect, it } from "vitest";
import type { RealtimeSocket } from "./roomHandlers";
import { createUserSockets } from "./userSockets";

function fakeSocket(userId: string): RealtimeSocket {
  return { data: { user: { id: userId } } } as unknown as RealtimeSocket;
}

describe("userSockets", () => {
  it("indexes sockets per user", () => {
    const sockets = createUserSockets();
    const a1 = fakeSocket("a");
    const a2 = fakeSocket("a");
    const b = fakeSocket("b");
    sockets.add(a1);
    sockets.add(a2);
    sockets.add(b);

    expect(sockets.of("a")).toEqual([a1, a2]);
    expect(sockets.count("a")).toBe(2);
    expect(sockets.count("b")).toBe(1);
    expect(sockets.of("c")).toEqual([]);
  });

  it("removes sockets and forgets users with none left", () => {
    const sockets = createUserSockets();
    const a1 = fakeSocket("a");
    sockets.add(a1);
    sockets.remove(a1);
    sockets.remove(a1);

    expect(sockets.count("a")).toBe(0);
    expect(sockets.of("a")).toEqual([]);
  });

  it("returns a copy that is safe to iterate while sockets are removed", () => {
    const sockets = createUserSockets();
    sockets.add(fakeSocket("a"));
    sockets.add(fakeSocket("a"));

    for (const s of sockets.of("a")) sockets.remove(s);
    expect(sockets.count("a")).toBe(0);
  });
});
