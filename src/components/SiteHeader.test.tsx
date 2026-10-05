import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/auth/types";
import { getDictionary } from "@/i18n/dictionaries";
import { SiteHeader } from "./SiteHeader";

vi.mock("next/navigation", () => ({ usePathname: () => "/fr" }));
// Le formulaire de déconnexion branche l'action serveur ; seul son câblage est vérifié ici.
vi.mock("@/auth/actions", () => ({ logout: vi.fn() }));

const member: CurrentUser = {
  id: "11111111-1111-1111-1111-111111111111",
  kind: "member",
  displayName: "Alice_B",
  username: "alice_b",
  locale: "fr",
};
const guest: CurrentUser = { ...member, kind: "guest", displayName: "Zoé", username: null };

describe("SiteHeader", () => {
  it.each(["fr", "en"] as const)("affiche le nom, le sélecteur de langue et le thème traduits (%s)", (locale) => {
    const dictionary = getDictionary(locale);
    render(<SiteHeader locale={locale} dictionary={dictionary} user={null} />);

    expect(screen.getByRole("banner")).toHaveTextContent(dictionary.site.name);
    const other = locale === "fr" ? "en" : "fr";
    expect(screen.getByRole("link", { name: dictionary.language.names[other] })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: dictionary.theme.label })).toBeInTheDocument();
  });

  it.each(["fr", "en"] as const)("le logo mène à l'accueil de la langue et porte la signature traduite (%s)", (locale) => {
    const dictionary = getDictionary(locale);
    render(<SiteHeader locale={locale} dictionary={dictionary} user={null} />);

    const home = screen.getByRole("link", { name: new RegExp(dictionary.site.name) });
    expect(home).toHaveAttribute("href", `/${locale}`);
    expect(home).toHaveTextContent(dictionary.brand.tagline);
  });

  describe.each(["fr", "en"] as const)("visiteur (%s)", (locale) => {
    it("propose « Se connecter » vers la page de connexion, sans déconnexion", () => {
      const dictionary = getDictionary(locale);
      render(<SiteHeader locale={locale} dictionary={dictionary} user={null} />);

      expect(screen.getByRole("link", { name: dictionary.header.signIn })).toHaveAttribute("href", `/${locale}/login`);
      expect(screen.queryByRole("button", { name: dictionary.header.signOut })).toBeNull();
    });
  });

  describe.each(["fr", "en"] as const)("connecté (%s)", (locale) => {
    it("affiche le nom du membre et un bouton de déconnexion, sans lien de connexion", () => {
      const dictionary = getDictionary(locale);
      render(<SiteHeader locale={locale} dictionary={dictionary} user={member} />);

      expect(screen.getByText("Alice_B")).toBeInTheDocument();
      expect(screen.queryByText(`(${dictionary.header.guest})`)).toBeNull();
      expect(screen.getByRole("button", { name: dictionary.header.signOut })).toHaveAttribute("type", "submit");
      expect(screen.queryByRole("link", { name: dictionary.header.signIn })).toBeNull();
    });

    it("le formulaire de déconnexion porte la langue en champ caché", () => {
      const dictionary = getDictionary(locale);
      const { container } = render(<SiteHeader locale={locale} dictionary={dictionary} user={member} />);

      const input = container.querySelector<HTMLInputElement>('form input[name="locale"]');
      expect(input).toHaveAttribute("type", "hidden");
      expect(input?.value).toBe(locale);
    });

    it("signale un invité par la mention traduite", () => {
      const dictionary = getDictionary(locale);
      render(<SiteHeader locale={locale} dictionary={dictionary} user={guest} />);

      expect(screen.getByText("Zoé")).toBeInTheDocument();
      expect(screen.getByText(`(${dictionary.header.guest})`)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: dictionary.header.signOut })).toBeInTheDocument();
    });
  });
});
