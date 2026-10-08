import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSessionExpiryWatcher, MAX_TIMEOUT_MS } from "./sessionExpiry";

function fakeSocket(id = "s1") {
  const listeners: Array<() => void> = [];
  return {
    id,
    disconnect: vi.fn(),
    once: vi.fn((_event: string, listener: () => void) => {
      listeners.push(listener);
    }),
    fireDisconnect: () => listeners.forEach((l) => l()),
  };
}

describe("sessionExpiry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const watcher = () => createSessionExpiryWatcher(() => new Date());

  it("disconnects the socket at the expiry, forcing the transport closed", () => {
    const w = watcher();
    const socket = fakeSocket();
    w.watch(socket as never, new Date(Date.now() + 1000));

    vi.advanceTimersByTime(999);
    expect(socket.disconnect).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(socket.disconnect).toHaveBeenCalledWith(true);
    expect(w.size).toBe(0);
  });

  it("disconnects at once when the expiry is already past", () => {
    const w = watcher();
    const socket = fakeSocket();
    w.watch(socket as never, new Date(Date.now() - 1));
    expect(socket.disconnect).toHaveBeenCalledWith(true);
  });

  it("steps over the setTimeout limit for far expiries", () => {
    const w = watcher();
    const socket = fakeSocket();
    w.watch(socket as never, new Date(Date.now() + MAX_TIMEOUT_MS + 5000));

    vi.advanceTimersByTime(MAX_TIMEOUT_MS);
    expect(socket.disconnect).not.toHaveBeenCalled();
    expect(w.size).toBe(1);
    vi.advanceTimersByTime(5000);
    expect(socket.disconnect).toHaveBeenCalledWith(true);
  });

  it("cancels when the socket disconnects first", () => {
    const w = watcher();
    const socket = fakeSocket();
    w.watch(socket as never, new Date(Date.now() + 1000));
    socket.fireDisconnect();

    expect(w.size).toBe(0);
    vi.advanceTimersByTime(5000);
    expect(socket.disconnect).not.toHaveBeenCalled();
  });

  it("close clears everything and ignores later watches", () => {
    const w = watcher();
    const socket = fakeSocket();
    w.watch(socket as never, new Date(Date.now() + 1000));
    w.close();
    w.watch(fakeSocket("s2") as never, new Date(Date.now() + 1000));

    expect(w.size).toBe(0);
    vi.advanceTimersByTime(5000);
    expect(socket.disconnect).not.toHaveBeenCalled();
  });
});
