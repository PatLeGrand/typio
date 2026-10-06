// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { fetchOAuthProfile, OAuthProfileError } from "./profile";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function mockFetch(response: Response | Error) {
  return vi.fn<(input: string, init: RequestInit) => Promise<Response>>(async () => {
    if (response instanceof Error) throw response;
    return response;
  });
}

describe("fetchOAuthProfile: GitHub", () => {
  const body = { id: 583231, login: "octocat", name: "The Octocat", email: "secret@example.com", avatar_url: "x" };

  it("calls the user endpoint with the bearer token and the documented headers, 10 s timeout", async () => {
    const fetchImpl = mockFetch(jsonResponse(body));

    await fetchOAuthProfile("github", "gho_token", fetchImpl);

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api.github.com/user");
    expect(init.method).toBe("GET");
    expect(init.headers).toEqual({
      Authorization: "Bearer gho_token",
      "User-Agent": "Typio",
      Accept: "application/vnd.github+json",
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("returns only the numeric id (as text) and the login: never the name, email or avatar", async () => {
    const profile = await fetchOAuthProfile("github", "t", mockFetch(jsonResponse(body)));

    expect(profile).toEqual({ accountId: "583231", login: "octocat" });
  });

  it.each([
    ["a string id", { id: "583231", login: "x" }],
    ["a zero id", { id: 0, login: "x" }],
    ["a negative id", { id: -3, login: "x" }],
    ["a fractional id", { id: 1.5, login: "x" }],
    ["an unsafe integer id", { id: 2 ** 60, login: "x" }],
    ["a missing login", { id: 5 }],
    ["an empty login", { id: 5, login: "" }],
    ["an array", [1, 2]],
    ["null", null],
  ])("rejects %s", async (_label, payload) => {
    await expect(fetchOAuthProfile("github", "t", mockFetch(jsonResponse(payload)))).rejects.toBeInstanceOf(
      OAuthProfileError,
    );
  });
});

describe("fetchOAuthProfile: Discord", () => {
  const body = { id: "80351110224678912", username: "nelly", global_name: "Nelly", avatar: "abc", email: "x@y.z" };

  it("calls /users/@me with the bearer token", async () => {
    const fetchImpl = mockFetch(jsonResponse(body));

    await fetchOAuthProfile("discord", "disc_token", fetchImpl);

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://discord.com/api/users/@me");
    expect(init.headers).toMatchObject({ Authorization: "Bearer disc_token", Accept: "application/json" });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("returns only the snowflake and the username: never the global name, email or avatar", async () => {
    expect(await fetchOAuthProfile("discord", "t", mockFetch(jsonResponse(body)))).toEqual({
      accountId: "80351110224678912",
      login: "nelly",
    });
  });

  it.each([
    ["a numeric id", { id: 80351110224678912, username: "x" }],
    ["a non-numeric id", { id: "abc", username: "x" }],
    ["an overlong id", { id: "1".repeat(30), username: "x" }],
    ["a missing username", { id: "123" }],
    ["an empty username", { id: "123", username: "" }],
  ])("rejects %s", async (_label, payload) => {
    await expect(fetchOAuthProfile("discord", "t", mockFetch(jsonResponse(payload)))).rejects.toBeInstanceOf(
      OAuthProfileError,
    );
  });
});

describe("fetchOAuthProfile: failures", () => {
  it.each(["github", "discord"] as const)("rejects an HTTP error status without echoing the token (%s)", async (provider) => {
    const error = await fetchOAuthProfile(provider, "super-secret-token", mockFetch(jsonResponse({ message: "Bad" }, 401))).catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(OAuthProfileError);
    expect(String((error as Error).message)).toContain("401");
    expect(String((error as Error).message)).not.toContain("super-secret-token");
  });

  it("propagates a network error", async () => {
    await expect(fetchOAuthProfile("github", "t", mockFetch(new TypeError("fetch failed")))).rejects.toThrow(
      "fetch failed",
    );
  });

  it("rejects a body that is not JSON", async () => {
    const html = new Response("<html>", { status: 200 });
    await expect(fetchOAuthProfile("github", "t", mockFetch(html))).rejects.toThrow();
  });

  it.each(["github", "discord"] as const)("passes a 10 second AbortSignal.timeout to the request (%s)", async (provider) => {
    const timeout = vi.spyOn(AbortSignal, "timeout");
    const fetchImpl = mockFetch(jsonResponse({ id: provider === "github" ? 1 : "1", login: "a", username: "a" }));

    await fetchOAuthProfile(provider, "t", fetchImpl);

    expect(timeout).toHaveBeenCalledWith(10_000);
    expect(fetchImpl.mock.calls[0][1].signal).toBe(timeout.mock.results[0].value);
    timeout.mockRestore();
  });
});
