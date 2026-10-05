import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDictionary } from "@/i18n/dictionaries";

const mocks = vi.hoisted(() => ({ pathname: "/fr" }));
vi.mock("next/navigation", () => ({ usePathname: () => mocks.pathname }));

import ErrorPage from "./error";

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("ErrorPage", () => {
  it.each(["fr", "en"] as const)("affiche un message et un bouton « Réessayer » traduits (%s)", (locale) => {
    mocks.pathname = `/${locale}/login`;
    const { errorPage } = getDictionary(locale);
    render(<ErrorPage error={new Error("boom")} retry={() => {}} />);

    expect(screen.getByRole("heading", { level: 1, name: errorPage.title })).toBeInTheDocument();
    expect(screen.getByText(errorPage.text)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: errorPage.retry })).toBeInTheDocument();
  });

  it("le bouton relance le rendu (retry)", () => {
    mocks.pathname = "/fr";
    const retry = vi.fn();
    render(<ErrorPage error={new Error("boom")} retry={retry} />);

    fireEvent.click(screen.getByRole("button", { name: getDictionary("fr").errorPage.retry }));

    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("retombe sur le français quand le chemin n'a pas de langue", () => {
    mocks.pathname = "/";
    render(<ErrorPage error={new Error("boom")} retry={() => {}} />);

    expect(screen.getByRole("button", { name: getDictionary("fr").errorPage.retry })).toBeInTheDocument();
  });

  it("ne journalise que le digest, jamais le message de l'erreur", () => {
    mocks.pathname = "/fr";
    render(<ErrorPage error={Object.assign(new Error("secret message"), { digest: "abc123" })} retry={() => {}} />);

    expect(console.error).toHaveBeenCalledWith("[app] route error", { digest: "abc123" });
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("secret message");
  });
});
