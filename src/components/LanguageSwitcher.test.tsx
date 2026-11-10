import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { getDictionary } from "@/i18n/dictionaries";
import { LanguageSwitcher } from "./LanguageSwitcher";

const usePathname = vi.hoisted(() => vi.fn<() => string>());
vi.mock("next/navigation", () => ({ usePathname }));

describe("LanguageSwitcher", () => {
  it("depuis le français, propose l'anglais, nommé par son texte visible", () => {
    usePathname.mockReturnValue("/fr");
    render(<LanguageSwitcher locale="fr" labels={getDictionary("fr").language} />);

    const link = screen.getByRole("link", { name: "English" });
    expect(link).toHaveAttribute("href", "/en");
    expect(link).toHaveAttribute("hreflang", "en");
    expect(link).toHaveAttribute("lang", "en");
    expect(link).not.toHaveAttribute("aria-label");
    expect(link).toHaveClass("border", "border-border", "bg-surface", "text-foreground");
  });

  it("depuis l'anglais, propose le français", () => {
    usePathname.mockReturnValue("/en");
    render(<LanguageSwitcher locale="en" labels={getDictionary("en").language} />);

    const link = screen.getByRole("link", { name: "Français" });
    expect(link).toHaveAttribute("href", "/fr");
    expect(link).toHaveAttribute("hreflang", "fr");
    expect(link).toHaveAttribute("lang", "fr");
  });

  it("mène au même chemin dans l'autre langue", () => {
    usePathname.mockReturnValue("/en/room/abc");
    render(<LanguageSwitcher locale="en" labels={getDictionary("en").language} />);

    expect(screen.getByRole("link", { name: "Français" })).toHaveAttribute("href", "/fr/room/abc");
  });

  it("le nom accessible compact commence par le texte visible", () => {
    usePathname.mockReturnValue("/fr");
    render(<LanguageSwitcher locale="fr" labels={getDictionary("fr").language} compact />);

    const link = screen.getByRole("link", { name: "EN — English" });
    expect(link).toHaveTextContent("EN");
    expect(link).toHaveClass("min-h-11", "text-muted", "hover:bg-accent-soft", "hover:text-foreground");
    expect(link).not.toHaveClass("border", "border-border", "bg-surface");
  });
});
