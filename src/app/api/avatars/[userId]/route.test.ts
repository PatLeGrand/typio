// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getCurrentUser: vi.fn(), where: vi.fn() }));
vi.mock("@/auth/currentUser", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/db/shared", () => ({
  getDb: () => ({ select: () => ({ from: () => ({ innerJoin: () => ({ where: mocks.where }) }) }) }),
}));

import { GET } from "./route";

const userId = "11111111-1111-4111-8111-111111111111";
const call = (id = userId, query = "?v=42") => GET(new Request(`http://localhost/api/avatars/${id}${query}`), {
  params: Promise.resolve({ userId: id }),
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentUser.mockResolvedValue({ id: "another-user", kind: "guest" });
  mocks.where.mockResolvedValue([{ image: Buffer.from("webp") }]);
});

describe("GET avatar", () => {
  it("exige une session avant toute lecture", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    const response = await call();
    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(mocks.where).not.toHaveBeenCalled();
  });

  it.each(["invalid", "../users", "11111111-1111-1111-1111-111111111111"])("valide l'UUID %s", async (id) => {
    expect((await call(id)).status).toBe(400);
    expect(mocks.where).not.toHaveBeenCalled();
  });

  it.each(["?v=NaN", "?v=-1", "?v=1.5", "?v=2147483648"])("valide la version %s", async (query) => {
    expect((await call(userId, query)).status).toBe(400);
    expect(mocks.where).not.toHaveBeenCalled();
  });

  it("sert le WebP inline à une session valide, même invitée, avec un cache privé", async () => {
    const response = await call();
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/webp");
    expect(response.headers.get("Content-Disposition")).toBe("inline");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Cache-Control")).toBe("private, max-age=31536000, immutable");
    expect(await response.text()).toBe("webp");
  });

  it("ne fige pas dans le cache l'URL sans version", async () => {
    expect((await call(userId, "")).headers.get("Cache-Control")).toBe("no-store");
  });

  it("renvoie 404 sans cache si la photo ou la version n'existe pas", async () => {
    mocks.where.mockResolvedValue([]);
    const response = await call();
    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("échoue sans fuite si l'authentification est indisponible", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.getCurrentUser.mockRejectedValue(new Error("secret"));
    const response = await call();
    expect(response.status).toBe(500);
    expect(await response.text()).toBe("");
    expect(mocks.where).not.toHaveBeenCalled();
    expect(JSON.stringify(spy.mock.calls)).not.toContain("secret");
    spy.mockRestore();
  });
});
