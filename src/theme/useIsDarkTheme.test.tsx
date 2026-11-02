import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useIsDarkTheme } from "./useIsDarkTheme";

afterEach(() => document.documentElement.classList.remove("dark"));

describe("useIsDarkTheme (DES-05, A11Y-01)", () => {
  it("suit la classe dark de <html>, au chargement puis en direct", async () => {
    const { result, unmount } = renderHook(() => useIsDarkTheme());
    expect(result.current).toBe(false);
    await act(async () => {
      document.documentElement.classList.add("dark");
      await Promise.resolve();
    });
    expect(result.current).toBe(true);
    await act(async () => {
      document.documentElement.classList.remove("dark");
      await Promise.resolve();
    });
    expect(result.current).toBe(false);
    unmount();
  });

  it("démarre en sombre quand la classe est déjà posée", () => {
    document.documentElement.classList.add("dark");
    const { result } = renderHook(() => useIsDarkTheme());
    expect(result.current).toBe(true);
  });
});
