import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { getDictionary } from "@/i18n/dictionaries";

const mocks = vi.hoisted(() => ({ pathname: "/fr/adresse-inconnue" }));
vi.mock("next/navigation", () => ({ usePathname: () => mocks.pathname }));

import NotFoundPage from "./not-found";

describe("NotFoundPage", () => {
  it.each(["fr", "en"] as const)("affiche la page 404 traduite et un retour à l'accueil (%s)", (locale) => {
    mocks.pathname = `/${locale}/adresse-inconnue`;
    const { notFound } = getDictionary(locale);

    render(<NotFoundPage />);

    expect(screen.getByText(notFound.eyebrow)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: notFound.title })).toBeInTheDocument();
    expect(screen.getByText(notFound.text)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: notFound.home })).toHaveAttribute("href", `/${locale}`);
  });

  it("retombe sur le français quand le chemin ne contient pas de locale supportée", () => {
    mocks.pathname = "/adresse-inconnue";

    render(<NotFoundPage />);

    expect(screen.getByRole("heading", { name: getDictionary("fr").notFound.title })).toBeInTheDocument();
  });
});
