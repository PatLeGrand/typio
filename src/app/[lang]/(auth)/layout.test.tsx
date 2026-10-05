import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ schedulePurge: vi.fn() }));
vi.mock("@/auth/schedulePurge", () => ({ schedulePurge: mocks.schedulePurge }));

import AuthRouteLayout from "./layout";

beforeEach(() => {
  mocks.schedulePurge.mockReset();
});

describe("AuthRouteLayout", () => {
  it("déclenche le nettoyage des sessions et invités échus et rend la page telle quelle", () => {
    render(
      <AuthRouteLayout>
        <p>page</p>
      </AuthRouteLayout>,
    );

    expect(mocks.schedulePurge).toHaveBeenCalledTimes(1);
    expect(screen.getByText("page")).toBeInTheDocument();
  });

  it("n'ajoute aucun en-tête : le cadre des pages d'authentification a le sien", () => {
    render(
      <AuthRouteLayout>
        <p>page</p>
      </AuthRouteLayout>,
    );

    expect(screen.queryByRole("banner")).toBeNull();
  });
});
