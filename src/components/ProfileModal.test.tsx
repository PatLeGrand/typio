import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { CurrentUser } from "@/auth/types";
import { getDictionary } from "@/i18n/dictionaries";
import { ProfileModal } from "./ProfileModal";

const member: CurrentUser = {
  id: "11111111-1111-1111-1111-111111111111",
  kind: "member",
  displayName: "Alice_B",
  username: "alice_b",
  locale: "fr",
};
const guest: CurrentUser = { ...member, kind: "guest", displayName: "Zoé", username: null };

function open(user: CurrentUser, locale: "fr" | "en") {
  const dictionary = getDictionary(locale);
  render(
    <ProfileModal user={user} dictionary={dictionary} locale={locale}>
      <span>{user.displayName}</span>
    </ProfileModal>,
  );
  fireEvent.click(screen.getByRole("button", { name: user.displayName }));
  return dictionary.profileDropdown;
}

describe.each(["fr", "en"] as const)("ProfileModal (%s)", (locale) => {
  it("n'affiche rien dans la boîte de dialogue tant qu'elle est fermée", () => {
    const dictionary = getDictionary(locale);
    render(
      <ProfileModal user={member} dictionary={dictionary} locale={locale}>
        <span>{member.displayName}</span>
      </ProfileModal>,
    );

    expect(screen.getAllByText(member.displayName)).toHaveLength(1);
    expect(screen.queryByText(dictionary.profileDropdown.viewFullProfile)).toBeNull();
  });

  it("membre : titre des statistiques, annonce « bientôt » et lien vers le profil complet", () => {
    const dict = open(member, locale);

    expect(screen.getByRole("dialog", { name: member.displayName })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: dict.stats.title })).toBeInTheDocument();
    expect(screen.getByText(dict.stats.comingSoon)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: dict.viewFullProfile })).toHaveAttribute("href", `/${locale}/profile`);
    expect(screen.getByRole("button", { name: dict.close })).toBeInTheDocument();
  });

  it("membre : aucun chiffre factice (0 course, 0 MPM) avant les vraies statistiques", () => {
    open(member, locale);
    const dialog = screen.getByRole("dialog", { name: member.displayName });

    expect(dialog.textContent).not.toMatch(/\d/);
    expect(dialog.textContent).not.toMatch(/MPM|WPM/);
  });

  it("invité : avertissement de perte des données et liens de connexion et d'inscription", () => {
    const dict = open(guest, locale);

    expect(screen.getByText(dict.guestWarning)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: dict.login })).toHaveAttribute("href", `/${locale}/login`);
    expect(screen.getByRole("link", { name: dict.register })).toHaveAttribute("href", `/${locale}/register`);
    expect(screen.queryByRole("link", { name: dict.viewFullProfile })).toBeNull();
    expect(screen.queryByText(dict.stats.title)).toBeNull();
  });

  it("l'événement natif « close » du dialogue (Échap) retire le contenu", () => {
    const dict = open(member, locale);
    const dialog = screen.getByRole("dialog", { name: member.displayName });
    expect(screen.getByText(dict.viewFullProfile)).toBeInTheDocument();

    act(() => {
      dialog.dispatchEvent(new Event("close"));
    });

    expect(screen.queryByText(dict.viewFullProfile)).toBeNull();
  });

  it("se ferme avec le bouton de fermeture", () => {
    const dict = open(member, locale);

    fireEvent.click(screen.getByRole("button", { name: dict.close }));

    expect(screen.queryByText(dict.viewFullProfile)).toBeNull();
  });
});
