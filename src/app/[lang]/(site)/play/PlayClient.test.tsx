import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDictionary } from "@/i18n/dictionaries";
import type { UseRoom } from "@/realtime/useRoom";
import { makeParticipant, makeRoom, makeUseRoom, ME } from "@/test/roomFixtures";

const mocks = vi.hoisted(() => ({
  useRoom: vi.fn<() => UseRoom>(),
  push: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("@/realtime/useRoom", () => ({ useRoom: mocks.useRoom }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, replace: mocks.replace }) }));

import { PlayClient } from "./PlayClient";

function renderPlay(locale: "fr" | "en", options: { isGuest?: boolean } = {}) {
  const { room: labels } = getDictionary(locale);
  render(<PlayClient locale={locale} userId={ME} isGuest={options.isGuest ?? false} labels={labels} />);
  return labels;
}

const inRoom = makeRoom([makeParticipant(ME)]);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.useRoom.mockImplementation(() => makeUseRoom());
});

describe.each(["fr", "en"] as const)("page de jeu, membre hors salle (%s)", (locale) => {
  it("propose de créer et de rejoindre, sans bandeau", () => {
    const labels = renderPlay(locale);
    expect(screen.getByRole("button", { name: labels.play.create.button })).toBeEnabled();
    expect(screen.getByRole("button", { name: labels.play.join.button })).toBeEnabled();
    expect(screen.queryByText(labels.play.inRoom.return)).not.toBeInTheDocument();
  });

  it("crée une salle puis ouvre sa page", async () => {
    const create = vi.fn<UseRoom["create"]>(async () => ({ ok: true, data: { code: "XYZ789" } }));
    mocks.useRoom.mockImplementation(() => makeUseRoom({ create }));
    const labels = renderPlay(locale);

    fireEvent.click(screen.getByRole("button", { name: labels.play.create.button }));

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith(`/${locale}/room/XYZ789`));
  });

  it("création refusée : reste sur la page et affiche l'erreur traduite", async () => {
    const create = vi.fn<UseRoom["create"]>(async () => ({ ok: false, error: "OFFLINE" }));
    mocks.useRoom.mockImplementation(() => makeUseRoom({ create, error: "OFFLINE" }));
    const labels = renderPlay(locale);

    fireEvent.click(screen.getByRole("button", { name: labels.play.create.button }));
    await waitFor(() => expect(create).toHaveBeenCalled());

    expect(mocks.push).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(labels.errors.OFFLINE);
    expect(screen.queryByText("OFFLINE")).not.toBeInTheDocument();
  });

  it("rejoint avec un code valide : ouvre la page de la salle avec le rôle", () => {
    const labels = renderPlay(locale);
    fireEvent.change(screen.getByLabelText(labels.play.join.codeLabel), { target: { value: "abc-234" } });
    fireEvent.click(screen.getByRole("radio", { name: labels.play.join.spectator }));
    fireEvent.click(screen.getByRole("button", { name: labels.play.join.button }));

    expect(mocks.push).toHaveBeenCalledWith(`/${locale}/room/ABC234?role=spectator`);
  });

  it("n'ouvre rien pour un code invalide", () => {
    const labels = renderPlay(locale);
    fireEvent.change(screen.getByLabelText(labels.play.join.codeLabel), { target: { value: "12" } });
    fireEvent.click(screen.getByRole("button", { name: labels.play.join.button }));

    expect(mocks.push).not.toHaveBeenCalled();
    expect(screen.getByText(labels.errors.INVALID_CODE)).toBeVisible();
  });
});

describe("opération en cours", () => {
  it("pendant une création, « Rejoindre » est désactivé", async () => {
    const create = vi.fn<UseRoom["create"]>(() => new Promise(() => undefined));
    mocks.useRoom.mockImplementation(() => makeUseRoom({ create }));
    const labels = renderPlay("fr");

    fireEvent.click(screen.getByRole("button", { name: labels.play.create.button }));

    await waitFor(() => expect(screen.getByRole("button", { name: labels.play.join.button })).toBeDisabled());
    expect(screen.getByLabelText(labels.play.join.codeLabel)).toBeDisabled();
  });

  it("pendant un départ, « Rejoindre » est désactivé", async () => {
    const leave = vi.fn<UseRoom["leave"]>(() => new Promise(() => undefined));
    mocks.useRoom.mockImplementation(() => makeUseRoom({ room: inRoom, leave }));
    const labels = renderPlay("fr");

    fireEvent.click(screen.getByRole("button", { name: labels.play.inRoom.leave }));

    await waitFor(() => expect(screen.getByRole("button", { name: labels.play.inRoom.leave })).toBeDisabled());
    expect(screen.getByRole("button", { name: labels.play.join.button })).toBeDisabled();
  });

  it("une fois « Rejoindre » lancé, « Créer » est désactivé : pas deux navigations", () => {
    const labels = renderPlay("fr");
    fireEvent.change(screen.getByLabelText(labels.play.join.codeLabel), { target: { value: "ABC234" } });
    fireEvent.click(screen.getByRole("button", { name: labels.play.join.button }));

    expect(mocks.push).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: labels.play.create.button })).toBeDisabled();
    expect(screen.getByRole("button", { name: labels.play.join.button })).toBeDisabled();
  });
});

describe.each(["fr", "en"] as const)("déjà dans une salle (D7) (%s)", (locale) => {
  beforeEach(() => {
    mocks.useRoom.mockImplementation(() => makeUseRoom({ room: inRoom }));
  });

  it("affiche le code de la salle avec « Y retourner »", () => {
    const labels = renderPlay(locale);
    expect(screen.getByText(labels.play.inRoom.message.replace("{code}", "ABC234"))).toBeVisible();
    expect(screen.getByRole("link", { name: labels.play.inRoom.return })).toHaveAttribute(
      "href",
      `/${locale}/room/ABC234`,
    );
  });

  it("désactive la création et « rejoindre avec un code »", () => {
    const labels = renderPlay(locale);
    expect(screen.getByRole("button", { name: labels.play.create.button })).toBeDisabled();
    expect(screen.getByLabelText(labels.play.join.codeLabel)).toBeDisabled();
    expect(screen.getByRole("button", { name: labels.play.join.button })).toBeDisabled();
  });

  it("« Quitter » quitte la salle", async () => {
    const leave = vi.fn<UseRoom["leave"]>(async () => ({ ok: true, data: undefined }));
    mocks.useRoom.mockImplementation(() => makeUseRoom({ room: inRoom, leave }));
    const labels = renderPlay(locale);

    fireEvent.click(screen.getByRole("button", { name: labels.play.inRoom.leave }));

    await waitFor(() => expect(leave).toHaveBeenCalledTimes(1));
  });
});

describe.each(["fr", "en"] as const)("invité (SALLE-12) (%s)", (locale) => {
  it("création désactivée, raison affichée et reliée au bouton ; rejoindre reste possible", () => {
    const labels = renderPlay(locale, { isGuest: true });
    const create = screen.getByRole("button", { name: labels.play.create.button });

    expect(create).toBeDisabled();
    expect(create).toHaveAccessibleDescription(labels.play.create.guestNotice);
    expect(screen.getByRole("button", { name: labels.play.join.button })).toBeEnabled();
  });
});

describe("connexion", () => {
  it("bandeau « Connexion perdue » hors ligne", () => {
    mocks.useRoom.mockImplementation(() => makeUseRoom({ connection: "offline" }));
    const labels = renderPlay("fr");
    expect(screen.getByRole("status")).toHaveTextContent(labels.connection.offline);
  });

  it("session refusée : redirige vers la connexion", () => {
    mocks.useRoom.mockImplementation(() => makeUseRoom({ connection: "unauthenticated" }));
    renderPlay("en");
    expect(mocks.replace).toHaveBeenCalledWith("/en/login");
  });
});
