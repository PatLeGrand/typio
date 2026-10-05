import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { getDictionary } from "@/i18n/dictionaries";
import { SiteHeader } from "./SiteHeader";

vi.mock("next/navigation", () => ({ usePathname: () => "/fr" }));

describe("SiteHeader", () => {
  it.each(["fr", "en"] as const)("affiche le nom, le sélecteur de langue et le thème traduits (%s)", (locale) => {
    const dictionary = getDictionary(locale);
    render(<SiteHeader locale={locale} dictionary={dictionary} />);

    expect(screen.getByRole("banner")).toHaveTextContent(dictionary.site.name);
    const other = locale === "fr" ? "en" : "fr";
    expect(screen.getByRole("link", { name: dictionary.language.names[other] })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: dictionary.theme.label })).toBeInTheDocument();
  });

  it.each(["fr", "en"] as const)("le logo mène à l'accueil de la langue et porte la signature traduite (%s)", (locale) => {
    const dictionary = getDictionary(locale);
    render(<SiteHeader locale={locale} dictionary={dictionary} />);

    const home = screen.getByRole("link", { name: new RegExp(dictionary.site.name) });
    expect(home).toHaveAttribute("href", `/${locale}`);
    expect(home).toHaveTextContent(dictionary.brand.tagline);
  });
});
