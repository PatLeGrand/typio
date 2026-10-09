import { describe, expect, it } from "vitest";
import {
  AUTH_RATE_LIMITS,
  createAuthLimiters,
  createRateLimiter,
  getClientIp,
  ipRateLimitKey,
  loginFailureKey,
} from "./rateLimit";

const MINUTE = 60 * 1000;

function clock(start = 1_000_000) {
  let current = start;
  return {
    now: () => current,
    advance(ms: number) {
      current += ms;
    },
  };
}

describe("createRateLimiter", () => {
  it("allows up to the limit then refuses, without recording refused events", () => {
    const time = clock();
    const limiter = createRateLimiter({ limit: 3, windowMs: 10 * MINUTE, now: time.now });

    expect([1, 2, 3].map(() => limiter.consume("k"))).toEqual([true, true, true]);
    expect(limiter.consume("k")).toBe(false);
    expect(limiter.consume("k")).toBe(false);
  });

  it("slides: an event stops counting exactly one window after it happened", () => {
    const time = clock();
    const limiter = createRateLimiter({ limit: 2, windowMs: 10 * MINUTE, now: time.now });

    limiter.record("k"); // t = 0
    time.advance(4 * MINUTE);
    limiter.record("k"); // t = 4
    expect(limiter.isLimited("k")).toBe(true);

    time.advance(6 * MINUTE - 1); // t = 10 min - 1 ms : the first event is still in the window
    expect(limiter.isLimited("k")).toBe(true);

    time.advance(1); // t = 10 min : the first event leaves the window
    expect(limiter.isLimited("k")).toBe(false);
    expect(limiter.consume("k")).toBe(true);
    expect(limiter.isLimited("k")).toBe(true);
  });

  it("does not reset the whole count at a fixed boundary", () => {
    const time = clock();
    const limiter = createRateLimiter({ limit: 2, windowMs: 10 * MINUTE, now: time.now });

    time.advance(9 * MINUTE);
    limiter.record("k");
    limiter.record("k");
    time.advance(2 * MINUTE); // a fixed window would have reset by now
    expect(limiter.isLimited("k")).toBe(true);
  });

  it("keeps keys independent", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: MINUTE, now: clock().now });

    expect(limiter.consume("a")).toBe(true);
    expect(limiter.consume("a")).toBe(false);
    expect(limiter.consume("b")).toBe(true);
  });

  it("reset forgets a key", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: MINUTE, now: clock().now });
    limiter.record("k");
    expect(limiter.isLimited("k")).toBe(true);

    limiter.reset("k");

    expect(limiter.isLimited("k")).toBe(false);
  });

  it("release gives back the last reserved attempt only", () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 10 * MINUTE, now: clock().now });
    limiter.consume("k");
    limiter.consume("k");
    expect(limiter.consume("k")).toBe(false);

    limiter.release("k");

    expect(limiter.consume("k")).toBe(true);
    expect(limiter.consume("k")).toBe(false);
  });

  it("release removes the most recent timestamp, keeping the older one's expiry", () => {
    const time = clock();
    const limiter = createRateLimiter({ limit: 2, windowMs: 10 * MINUTE, now: time.now });
    limiter.consume("k"); // t = 0
    time.advance(5 * MINUTE);
    limiter.consume("k"); // t = 5
    limiter.release("k"); // drops t = 5

    time.advance(5 * MINUTE); // t = 10 : the t = 0 event has left the window
    expect(limiter.isLimited("k")).toBe(false);
    expect(limiter.size()).toBe(0);
  });

  it("release on an unknown or empty key is a no-op", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: MINUTE, now: clock().now });
    limiter.release("nothing");
    limiter.consume("k");
    limiter.release("k");
    limiter.release("k");
    expect(limiter.size()).toBe(0);
  });

  it("isLimited never records anything", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: MINUTE, now: clock().now });
    for (let i = 0; i < 5; i += 1) limiter.isLimited("k");
    expect(limiter.size()).toBe(0);
  });

  it("purges expired entries so memory does not grow with abandoned keys", () => {
    const time = clock();
    const limiter = createRateLimiter({ limit: 1, windowMs: 10 * MINUTE, now: time.now });
    for (let i = 0; i < 100; i += 1) limiter.record(`ip-${i}`);
    expect(limiter.size()).toBe(100);

    time.advance(11 * MINUTE);
    limiter.isLimited("someone-else");

    expect(limiter.size()).toBe(0);
  });

  it("caps the number of tracked keys by dropping the least recently written", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 10 * MINUTE, maxKeys: 5, now: clock().now });
    for (let i = 0; i < 20; i += 1) limiter.record(`ip-${i}`);

    expect(limiter.size()).toBe(5);
    expect(limiter.isLimited("ip-19")).toBe(true);
    expect(limiter.isLimited("ip-0")).toBe(false);
  });

  it("prefers dropping expired keys over live ones when full", () => {
    const time = clock();
    const limiter = createRateLimiter({ limit: 1, windowMs: 10 * MINUTE, maxKeys: 3, now: time.now });
    limiter.record("old-1");
    limiter.record("old-2");
    time.advance(11 * MINUTE);
    limiter.record("live-1");

    limiter.record("live-2"); // full: the two expired keys are swept before any live one is evicted
    limiter.record("live-3");

    expect(["live-1", "live-2", "live-3"].map((key) => limiter.isLimited(key))).toEqual([true, true, true]);
  });

  it("does not sweep the whole table on every write once full", () => {
    const time = clock();
    const limiter = createRateLimiter({ limit: 1, windowMs: 10 * MINUTE, maxKeys: 1000, now: time.now });
    for (let i = 0; i < 1000; i += 1) limiter.record(`ip-${i}`);

    // Si chaque écriture parcourait tout, ces 5000 écritures feraient 5 millions de visites.
    const started = performance.now();
    for (let i = 0; i < 5000; i += 1) limiter.record(`flood-${i}`);

    expect(limiter.size()).toBe(1000);
    expect(performance.now() - started).toBeLessThan(500);
  });

  describe("onFull: refuse", () => {
    it("refuses a new key when every tracked key is still live, and keeps the victims' failures", () => {
      const limiter = createRateLimiter({ limit: 3, windowMs: 10 * MINUTE, maxKeys: 3, onFull: "refuse", now: clock().now });
      expect(limiter.consume("victim")).toBe(true);
      expect(limiter.consume("victim")).toBe(true);
      expect(limiter.consume("b")).toBe(true);
      expect(limiter.consume("c")).toBe(true);

      expect(limiter.consume("newcomer")).toBe(false);
      expect(limiter.size()).toBe(3);
      // La victime n'a rien oublié : son troisième essai passe, le quatrième est refusé.
      expect(limiter.consume("victim")).toBe(true);
      expect(limiter.consume("victim")).toBe(false);
    });

    it("keeps accepting keys that are already tracked when full", () => {
      const limiter = createRateLimiter({ limit: 5, windowMs: 10 * MINUTE, maxKeys: 2, onFull: "refuse", now: clock().now });
      limiter.consume("a");
      limiter.consume("b");

      expect(limiter.consume("a")).toBe(true);
      expect(limiter.consume("c")).toBe(false);
    });

    it("makes room again once keys expire (after a sweep)", () => {
      const time = clock();
      const limiter = createRateLimiter({ limit: 1, windowMs: 10 * MINUTE, maxKeys: 2, onFull: "refuse", now: time.now });
      limiter.consume("a");
      limiter.consume("b");
      expect(limiter.consume("c")).toBe(false);

      time.advance(11 * MINUTE);

      expect(limiter.consume("c")).toBe(true);
      expect(limiter.size()).toBe(1);
    });

    it("record ignores a new key when full instead of evicting", () => {
      const limiter = createRateLimiter({ limit: 1, windowMs: 10 * MINUTE, maxKeys: 2, onFull: "refuse", now: clock().now });
      limiter.record("a");
      limiter.record("b");
      limiter.record("c");

      expect(limiter.size()).toBe(2);
      expect(limiter.isLimited("a")).toBe(true);
      expect(limiter.isLimited("c")).toBe(false);
    });

    it("does not sweep the whole table on every refused key", () => {
      const limiter = createRateLimiter({ limit: 1, windowMs: 10 * MINUTE, maxKeys: 1000, onFull: "refuse", now: clock().now });
      for (let i = 0; i < 1000; i += 1) limiter.consume(`ip-${i}`);

      const started = performance.now();
      for (let i = 0; i < 5000; i += 1) expect(limiter.consume(`flood-${i}`)).toBe(false);

      expect(performance.now() - started).toBeLessThan(500);
    });
  });

  it("truncates very long keys instead of storing them whole", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: MINUTE, now: clock().now });
    const longKey = "x".repeat(10_000);
    limiter.record(longKey);
    expect(limiter.isLimited(longKey)).toBe(true);
    expect(limiter.isLimited(`${"x".repeat(128)}y`)).toBe(true);
  });
});

describe("createAuthLimiters", () => {
  it("applies the documented limits", () => {
    expect(AUTH_RATE_LIMITS.loginFailures).toEqual({ limit: 5, windowMs: 15 * MINUTE });
    expect(AUTH_RATE_LIMITS.loginFailuresPerUsername).toEqual({
      limit: 50,
      windowMs: 15 * MINUTE,
      maxKeys: 100_000,
      onFull: "refuse",
    });
    expect(AUTH_RATE_LIMITS.loginAttempts).toEqual({ limit: 300, windowMs: 15 * MINUTE });
    expect(AUTH_RATE_LIMITS.registrations).toEqual({ limit: 60, windowMs: 60 * MINUTE });
    expect(AUTH_RATE_LIMITS.guests).toEqual({ limit: 120, windowMs: 60 * MINUTE });
    expect(AUTH_RATE_LIMITS.oauthStarts).toEqual({ limit: 300, windowMs: 15 * MINUTE });
    expect(AUTH_RATE_LIMITS.oauthCallbacks).toEqual({ limit: 300, windowMs: 15 * MINUTE });
    expect(AUTH_RATE_LIMITS.profileUpdates).toEqual({ limit: 20, windowMs: 15 * MINUTE });
  });

  it.each(["oauthStarts", "oauthCallbacks"] as const)("limits %s at 300 per IP per 15 minutes", (name) => {
    const time = clock();
    const limiter = createAuthLimiters(time.now)[name];

    for (let i = 0; i < 300; i += 1) expect(limiter.consume("1.1.1.1")).toBe(true);
    expect(limiter.consume("1.1.1.1")).toBe(false);
    expect(limiter.consume("2.2.2.2")).toBe(true);
    time.advance(15 * MINUTE);
    expect(limiter.consume("1.1.1.1")).toBe(true);
  });

  it("the per-username limiter never forgets a victim to make room: a new username is refused when full", () => {
    const limiters = createAuthLimiters(clock().now);
    limiters.loginFailuresPerUsername.consume("victim");
    for (let i = 0; i < 99_999; i += 1) limiters.loginFailuresPerUsername.consume(`user-${i}`);
    expect(limiters.loginFailuresPerUsername.size()).toBe(100_000);

    expect(limiters.loginFailuresPerUsername.consume("one-more")).toBe(false);
    expect(limiters.loginFailuresPerUsername.size()).toBe(100_000);
    expect(limiters.loginFailuresPerUsername.consume("victim")).toBe(true);
  });

  it("the other limiters keep evicting the oldest key", () => {
    const limiters = createAuthLimiters(clock().now);
    for (let i = 0; i < 10_001; i += 1) expect(limiters.guests.consume(`ip-${i}`)).toBe(true);
    expect(limiters.guests.size()).toBe(10_000);
  });

  it("limits login failures at 5 per window, guests at 120 per hour", () => {
    const time = clock();
    const limiters = createAuthLimiters(time.now);

    for (let i = 0; i < 5; i += 1) limiters.loginFailures.record("1.1.1.1|alice");
    expect(limiters.loginFailures.isLimited("1.1.1.1|alice")).toBe(true);
    time.advance(15 * MINUTE);
    expect(limiters.loginFailures.isLimited("1.1.1.1|alice")).toBe(false);

    for (let i = 0; i < 120; i += 1) expect(limiters.guests.consume("1.1.1.1")).toBe(true);
    expect(limiters.guests.consume("1.1.1.1")).toBe(false);
    time.advance(59 * MINUTE);
    expect(limiters.guests.consume("1.1.1.1")).toBe(false);
    time.advance(MINUTE);
    expect(limiters.guests.consume("1.1.1.1")).toBe(true);
  });

  it("limits a username to 50 attempts per window across every IP", () => {
    const limiters = createAuthLimiters(clock().now);

    for (let i = 0; i < 50; i += 1) expect(limiters.loginFailuresPerUsername.consume("alice")).toBe(true);
    expect(limiters.loginFailuresPerUsername.consume("alice")).toBe(false);
    expect(limiters.loginFailuresPerUsername.consume("bob")).toBe(true);
  });
});

describe("loginFailureKey", () => {
  it("separates the same IP on different usernames", () => {
    expect(loginFailureKey("1.1.1.1", "alice")).not.toBe(loginFailureKey("1.1.1.1", "bob"));
    expect(loginFailureKey("1.1.1.1", "alice")).not.toBe(loginFailureKey("2.2.2.2", "alice"));
  });
});

describe("ipRateLimitKey", () => {
  it("keeps an IPv4 address whole", () => {
    expect(ipRateLimitKey("203.0.113.7")).toBe("203.0.113.7");
    expect(ipRateLimitKey("203.0.113.8")).not.toBe(ipRateLimitKey("203.0.113.7"));
  });

  it("keeps non-address values as they are", () => {
    expect(ipRateLimitKey("unknown")).toBe("unknown");
  });

  it("groups IPv6 addresses by /64", () => {
    const a = ipRateLimitKey("2001:db8:1:2:aaaa:bbbb:cccc:dddd");
    const b = ipRateLimitKey("2001:db8:1:2:1111:2222:3333:4444");
    const c = ipRateLimitKey("2001:db8:1:3:aaaa:bbbb:cccc:dddd");

    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it("normalizes compression, case and leading zeros before grouping", () => {
    const expected = ipRateLimitKey("2001:db8:0:0:0:0:0:1");
    expect(ipRateLimitKey("2001:DB8::1")).toBe(expected);
    expect(ipRateLimitKey("2001:0db8:0000::ffff")).toBe(expected);
    expect(ipRateLimitKey("[2001:db8::1]")).toBe(expected);
    expect(ipRateLimitKey("2001:db8::1%eth0")).toBe(expected);
  });

  it("handles addresses that start with the compression", () => {
    expect(ipRateLimitKey("::1")).toBe(ipRateLimitKey("0:0:0:0:0:0:0:2"));
    expect(ipRateLimitKey("::1")).not.toBe(ipRateLimitKey("::1:0:0:0:1"));
  });

  it("keeps an IPv4-mapped IPv6 address as its IPv4 form", () => {
    expect(ipRateLimitKey("::ffff:203.0.113.7")).toBe("203.0.113.7");
    expect(ipRateLimitKey("::FFFF:cb00:7107")).toBe("203.0.113.7");
    expect(ipRateLimitKey("0:0:0:0:0:ffff:203.0.113.7")).toBe("203.0.113.7");
  });

  it("does not mistake other addresses starting with zeros for IPv4-mapped ones", () => {
    expect(ipRateLimitKey("::203.0.113.7")).not.toBe("203.0.113.7");
  });

  it("returns an unparseable colon-containing value unchanged instead of throwing", () => {
    expect(ipRateLimitKey("not:an:ip")).toBe("not:an:ip");
    expect(ipRateLimitKey("1::2::3")).toBe("1::2::3");
    expect(ipRateLimitKey("1:2:3:4:5:6:7:8:9")).toBe("1:2:3:4:5:6:7:8:9");
    expect(ipRateLimitKey("::ffff:999.1.1.1")).toBe("::ffff:999.1.1.1");
  });

  it("never collides an IPv6 /64 key with an IPv4 address", () => {
    expect(ipRateLimitKey("1::")).not.toMatch(/^\d+\.\d+\.\d+\.\d+$/);
  });
});

describe("getClientIp", () => {
  const headersOf = (values: Record<string, string>) => ({
    get: (name: string) => values[name] ?? null,
  });

  it("takes the first element of x-forwarded-for", () => {
    expect(getClientIp(headersOf({ "x-forwarded-for": "203.0.113.7, 10.0.0.1, 10.0.0.2" }))).toBe("203.0.113.7");
  });

  it("trims whitespace", () => {
    expect(getClientIp(headersOf({ "x-forwarded-for": "  203.0.113.7  " }))).toBe("203.0.113.7");
  });

  it("ignores x-real-ip, which a client could set itself", () => {
    expect(getClientIp(headersOf({ "x-real-ip": "198.51.100.4" }))).toBe("unknown");
    expect(
      getClientIp(headersOf({ "x-forwarded-for": "203.0.113.7", "x-real-ip": "198.51.100.4" })),
    ).toBe("203.0.113.7");
    expect(getClientIp(headersOf({ "x-forwarded-for": " ", "x-real-ip": "198.51.100.4" }))).toBe("unknown");
  });

  it("returns unknown without x-forwarded-for", () => {
    expect(getClientIp(headersOf({}))).toBe("unknown");
  });

  it("bounds the length of the value", () => {
    expect(getClientIp(headersOf({ "x-forwarded-for": "9".repeat(500) }))).toHaveLength(64);
  });
});
