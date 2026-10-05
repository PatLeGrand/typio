import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { getDictionary } from "@/i18n/dictionaries";
import { AuthLayout } from "./AuthLayout";

vi.mock("next/navigation", () => ({ usePathname: () => "/fr/login" }));

describe("AuthLayout", () => {
  it.each(["fr", "en"] as const)("rend en-tête, contenu, panneau et pied de page traduits (%s)", (locale) => {
    const dictionary = getDictionary(locale);
    render(
      <AuthLayout locale={locale} dictionary={dictionary} panel={<p>panneau</p>}>
        <p>formulaire</p>
      </AuthLayout>,
    );

    expect(screen.getByRole("banner")).toHaveTextContent(dictionary.site.name);
    expect(screen.getByRole("link", { name: new RegExp(dictionary.site.name) })).toHaveAttribute("href", `/${locale}`);
    expect(screen.getByRole("main")).toHaveTextContent("formulaire");
    expect(screen.getByRole("complementary")).toHaveTextContent("panneau");

    const footer = screen.getByRole("contentinfo");
    expect(footer).toHaveTextContent(dictionary.footer.copyright);
    expect(screen.getByRole("link", { name: dictionary.footer.privacy })).toHaveAttribute("href", `/${locale}/privacy`);
    const other = locale === "fr" ? "en" : "fr";
    expect(screen.getByRole("link", { name: dictionary.language.names[other] })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: dictionary.theme.label })).toBeInTheDocument();
  });

  it("n'utilise pas le SiteHeader : un seul en-tête (banner)", () => {
    render(
      <AuthLayout locale="fr" dictionary={getDictionary("fr")} panel={null}>
        <p>x</p>
      </AuthLayout>,
    );
    expect(screen.getAllByRole("banner")).toHaveLength(1);
  });

  it("une colonne sous lg : le panneau est masqué, deux colonnes à partir de lg", () => {
    const { container } = render(
      <AuthLayout locale="fr" dictionary={getDictionary("fr")} panel={<p>panneau</p>}>
        <p>x</p>
      </AuthLayout>,
    );

    expect(screen.getByRole("complementary", { hidden: true })).toHaveClass("hidden", "lg:flex", "lg:sticky", "bg-accent-panel", "rounded-panel");
    expect(container.firstElementChild).toHaveClass("lg:grid-cols-2");
    expect(container.querySelector(".max-w-\\[660px\\]")).not.toBeNull();
  });
});
