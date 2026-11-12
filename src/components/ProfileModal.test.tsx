import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getProfileSummary } from "@/app/[lang]/(site)/profile/statsActions";
import type { CurrentUser } from "@/auth/types";
import { getDictionary } from "@/i18n/dictionaries";
import { ProfileModal } from "./ProfileModal";
import { plain } from "@/test/text";

vi.mock("@/app/[lang]/(site)/profile/statsActions", () => ({ getProfileSummary: vi.fn() }));

const stats = { raceCount: 12, wins: 3, bestWpm: 87.5, averageWpm: 62.4, averageAccuracy: 97.8 };

beforeEach(() => {
  vi.mocked(getProfileSummary).mockReset();
  vi.mocked(getProfileSummary).mockImplementation(() => new Promise(() => {}));
});

const member: CurrentUser = {
  id: "11111111-1111-1111-1111-111111111111",
  kind: "member",
  displayName: "Alice_B",
  username: "alice_b",
  locale: "fr", avatarVersion: null,
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

    expect(getProfileSummary).not.toHaveBeenCalled();
    expect(screen.getAllByText(member.displayName)).toHaveLength(1);
    expect(screen.queryByText(plain(dictionary.profileDropdown.viewFullProfile))).toBeNull();
  });

  it("membre : vraies statistiques et lien vers le profil complet", async () => {
    vi.mocked(getProfileSummary).mockResolvedValue({ ok: true, stats });
    const dict = open(member, locale);
    const labels = getDictionary(locale).profile.stats;
    const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
    const percent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 });

    await screen.findByText(number.format(stats.bestWpm));
    for (const [label, value] of [
      [labels.bestWpm, number.format(stats.bestWpm)],
      [labels.averageWpm, number.format(stats.averageWpm)],
      [labels.averageAccuracy, percent.format(stats.averageAccuracy / 100)],
      [labels.raceCount, number.format(stats.raceCount)],
      [labels.wins, number.format(stats.wins)],
    ]) {
      expect(screen.getByText(label).tagName).toBe("DT");
      expect(screen.getByText(label).nextElementSibling).toHaveTextContent(plain(value));
      expect(screen.getByText(label).nextElementSibling?.tagName).toBe("DD");
    }
    expect(getProfileSummary).toHaveBeenCalledTimes(1);

    expect(screen.getByRole("dialog", { name: member.displayName })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: dict.stats.title })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: dict.viewFullProfile })).toHaveAttribute("href", `/${locale}/profile`);
    expect(screen.getByRole("link", { name: getDictionary(locale).history.title })).toHaveAttribute("href", `/${locale}/history`);
    expect(screen.getByRole("button", { name: dict.close })).toBeInTheDocument();
  });

  it("membre : aucun chiffre factice (0 course, 0 MPM) avant les vraies statistiques", () => {
    const dict = open(member, locale);
    expect(screen.getByText(dict.stats.loading).parentElement).toHaveAttribute("aria-busy", "true");
    const dialog = screen.getByRole("dialog", { name: member.displayName });

    expect(dialog.textContent).not.toMatch(/\d/);
    expect(dialog.textContent).not.toMatch(/MPM|WPM/);
  });

  it("membre : aucune course et incitation à commencer", async () => {
    vi.mocked(getProfileSummary).mockResolvedValue({ ok: true, stats: { raceCount: 0, wins: 0, bestWpm: null, averageWpm: null, averageAccuracy: null } });
    const dict = open(member, locale);

    expect(await screen.findByText(plain(dict.stats.empty))).toBeInTheDocument();
    expect(screen.queryAllByRole("definition")).toHaveLength(0);
  });

  it("membre : affiche les valeurs absentes par un tiret", async () => {
    vi.mocked(getProfileSummary).mockResolvedValue({ ok: true, stats: { ...stats, bestWpm: null, averageWpm: null, averageAccuracy: null } });
    open(member, locale);

    expect(await screen.findAllByText(getDictionary(locale).profile.stats.noValue)).toHaveLength(3);
  });

  it.each(["result", "rejection"])("membre : erreur (%s)", async (mode) => {
    if (mode === "result") vi.mocked(getProfileSummary).mockResolvedValue({ ok: false });
    else vi.mocked(getProfileSummary).mockRejectedValue(new Error("Network unavailable"));
    const dict = open(member, locale);

    expect(await screen.findByText(dict.stats.error)).toBeInTheDocument();
  });

  it("recharge à la réouverture et ignore une ancienne réponse", async () => {
    let resolveFirst!: (value: Awaited<ReturnType<typeof getProfileSummary>>) => void;
    vi.mocked(getProfileSummary).mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }));
    const dict = open(member, locale);
    fireEvent.click(screen.getByRole("button", { name: dict.close }));
    vi.mocked(getProfileSummary).mockResolvedValueOnce({ ok: false });
    fireEvent.click(screen.getByRole("button", { name: member.displayName }));
    await screen.findByText(dict.stats.error);

    await act(async () => { resolveFirst({ ok: true, stats }); });

    expect(screen.getByText(dict.stats.error)).toBeInTheDocument();
    expect(getProfileSummary).toHaveBeenCalledTimes(2);
  });

  it("invité : avertissement de perte des données et liens de connexion et d'inscription", () => {
    const dict = open(guest, locale);
    expect(getProfileSummary).not.toHaveBeenCalled();

    expect(screen.getByText(dict.guestWarning)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: dict.login })).toHaveAttribute("href", `/${locale}/login`);
    expect(screen.getByRole("link", { name: dict.register })).toHaveAttribute("href", `/${locale}/register`);
    expect(screen.queryByRole("link", { name: dict.viewFullProfile })).toBeNull();
    expect(screen.queryByText(plain(dict.stats.title))).toBeNull();
    expect(screen.queryByRole("link", { name: getDictionary(locale).history.title })).toBeNull();
  });

  it("l'événement natif « close » du dialogue (Échap) retire le contenu", () => {
    const dict = open(member, locale);
    const dialog = screen.getByRole("dialog", { name: member.displayName });
    expect(screen.getByText(dict.viewFullProfile)).toBeInTheDocument();

    act(() => {
      dialog.dispatchEvent(new Event("close"));
    });

    expect(screen.queryByText(plain(dict.viewFullProfile))).toBeNull();
  });

  it("se ferme avec le bouton de fermeture", () => {
    const dict = open(member, locale);

    fireEvent.click(screen.getByRole("button", { name: dict.close }));

    expect(screen.queryByText(plain(dict.viewFullProfile))).toBeNull();
  });
});
