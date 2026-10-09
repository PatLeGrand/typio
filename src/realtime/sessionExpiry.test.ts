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

  describe("revalidation", () => {
    const REVALIDATE_MS = 1000;
    const revalidating = () => createSessionExpiryWatcher(() => new Date(), { revalidateMs: REVALIDATE_MS, random: () => 0 });
    const FAR = () => new Date(Date.now() + 10 * 60_000);

    it("disconnects the socket when the session is no longer valid", async () => {
      const w = revalidating();
      const socket = fakeSocket();
      const revalidate = vi.fn().mockResolvedValue(false);
      w.watch(socket as never, FAR(), revalidate);

      await vi.advanceTimersByTimeAsync(REVALIDATE_MS - 1);
      expect(revalidate).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);

      expect(revalidate).toHaveBeenCalledTimes(1);
      expect(socket.disconnect).toHaveBeenCalledWith(true);
      expect(w.size).toBe(0);
    });

    it("keeps a valid socket and checks again every interval with a single timer", async () => {
      const w = revalidating();
      const socket = fakeSocket();
      const revalidate = vi.fn().mockResolvedValue(true);
      w.watch(socket as never, FAR(), revalidate);

      await vi.advanceTimersByTimeAsync(REVALIDATE_MS * 3);

      expect(revalidate).toHaveBeenCalledTimes(3);
      expect(socket.disconnect).not.toHaveBeenCalled();
      expect(w.size).toBe(1);
    });

    it("keeps the socket when the check throws, and retries on the next turn", async () => {
      const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
      const w = revalidating();
      const socket = fakeSocket();
      const revalidate = vi
        .fn<() => Promise<boolean>>()
        .mockRejectedValueOnce(new Error("database unavailable"))
        .mockResolvedValue(false);
      w.watch(socket as never, FAR(), revalidate);

      await vi.advanceTimersByTimeAsync(REVALIDATE_MS);
      expect(socket.disconnect).not.toHaveBeenCalled();
      expect(w.size).toBe(1);
      expect(errors).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(REVALIDATE_MS);
      expect(socket.disconnect).toHaveBeenCalledWith(true);
      errors.mockRestore();
    });

    it("logs the error message only, never the error object", async () => {
      const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
      const w = revalidating();
      const failure = Object.assign(new Error("boom"), { cookie: "typio_session=secret" });
      w.watch(fakeSocket() as never, FAR(), vi.fn().mockRejectedValue(failure));

      await vi.advanceTimersByTimeAsync(REVALIDATE_MS);

      expect(JSON.stringify(errors.mock.calls)).not.toContain("secret");
      errors.mockRestore();
    });

    it("spreads the first check with a random offset", async () => {
      const w = createSessionExpiryWatcher(() => new Date(), { revalidateMs: REVALIDATE_MS, random: () => 0.5 });
      const revalidate = vi.fn().mockResolvedValue(true);
      w.watch(fakeSocket() as never, FAR(), revalidate);

      await vi.advanceTimersByTimeAsync(REVALIDATE_MS);
      expect(revalidate).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(REVALIDATE_MS * 0.05);
      expect(revalidate).toHaveBeenCalledTimes(1);
    });

    it("stops checking after the socket disconnects or the watcher closes", async () => {
      const w = revalidating();
      const gone = fakeSocket("gone");
      const stays = fakeSocket("stays");
      const revalidate = vi.fn().mockResolvedValue(true);
      w.watch(gone as never, FAR(), revalidate);
      w.watch(stays as never, FAR(), revalidate);

      gone.fireDisconnect();
      expect(w.size).toBe(1);
      w.close();
      expect(w.size).toBe(0);

      await vi.advanceTimersByTimeAsync(REVALIDATE_MS * 5);
      expect(revalidate).not.toHaveBeenCalled();
    });

    it("does not reschedule a check that was in flight when the socket disconnected", async () => {
      const w = revalidating();
      const socket = fakeSocket();
      let resolveCheck: (valid: boolean) => void = () => undefined;
      w.watch(
        socket as never,
        FAR(),
        () => new Promise<boolean>((resolve) => (resolveCheck = resolve)),
      );

      await vi.advanceTimersByTimeAsync(REVALIDATE_MS);
      socket.fireDisconnect();
      resolveCheck(true);
      await vi.advanceTimersByTimeAsync(0);

      expect(w.size).toBe(0);
    });
  });
});
