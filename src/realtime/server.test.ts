// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { startTestServer, waitForConnection } from "./testSupport";

let server: Awaited<ReturnType<typeof startTestServer>>;

beforeEach(async () => {
  server = await startTestServer();
});

afterEach(async () => {
  await server.close();
});

describe("realtime server", () => {
  it("answers the health check", async () => {
    const response = await fetch(`${server.url}/healthz`);
    expect(response.status).toBe(200);
  });

  it("accepts a member with a valid session cookie", async () => {
    const { token } = server.sessions.signIn("member");
    expect(await waitForConnection(server.client(token))).toEqual({ connected: true });
  });

  it("accepts a guest with a valid session cookie", async () => {
    const { token } = server.sessions.signIn("guest");
    expect(await waitForConnection(server.client(token))).toEqual({ connected: true });
  });

  it("refuses a connection without a session cookie", async () => {
    expect(await waitForConnection(server.client(null))).toEqual({
      connected: false,
      error: "UNAUTHENTICATED",
    });
  });

  it("refuses an unknown session token", async () => {
    const forged = "A".repeat(43);
    expect(await waitForConnection(server.client(forged))).toEqual({
      connected: false,
      error: "UNAUTHENTICATED",
    });
  });

  it("refuses a handshake from another origin even with a valid cookie", async () => {
    const { token } = server.sessions.signIn("member");
    const result = await waitForConnection(server.client(token, "https://evil.example"));
    expect(result.connected).toBe(false);
  });

  it("ignores room events without an acknowledgement instead of throwing", async () => {
    const { token } = server.sessions.signIn("member");
    const client = server.client(token);
    expect(await waitForConnection(client)).toEqual({ connected: true });
    client.emit("room:create", {});
    client.emit("room:join", { code: "ABCDEF", role: "runner" });
    client.emit("room:updateConfig", {});
    client.emit("room:leave");
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect((await fetch(`${server.url}/healthz`)).status).toBe(200);
  });
});
