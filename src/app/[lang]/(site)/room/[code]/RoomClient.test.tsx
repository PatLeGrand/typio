import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDictionary } from "@/i18n/dictionaries";
import { ROOM_ERROR_CODES } from "@/realtime/protocol";
import type { UseRoom } from "@/realtime/useRoom";
import { makeParticipant, makeRoom, makeUseRoom, ME, OTHER } from "@/test/roomFixtures";

const mocks = vi.hoisted(() => ({
  useRoom: vi.fn<() => UseRoom>(),
  replace: vi.fn(),
}));

vi.mock("@/realtime/useRoom", () => ({ useRoom: mocks.useRoom }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace, push: vi.fn() }) }));

import { RoomClient } from "./RoomClient";

let current: UseRoom;

/** Remplace le retour du faux `useRoom` et redessine : simule un changement du store. */
function setRoom(next: UseRoom, rerender?: () => void): void {
  current = next;
  rerender?.();
}

function renderRoom(options: { locale?: "fr" | "en"; userId?: string; code?: string; role?: "runner" | "spectator" } = {}) {
  const { locale = "fr", userId = ME, code = "ABC234", role = "runner" } = options;
  const { room: labels, raceSettings: settingsLabels } = getDictionary(locale);
  const ui = () => (
    <RoomClient code={code} role={role} locale={locale} userId={userId} labels={labels} settingsLabels={settingsLabels} />
  );
  return { ...render(ui()), ui, labels, settingsLabels };
}

const hostRoom = makeRoom([makeParticipant(ME), makeParticipant(OTHER, { role: "spectator", connected: false })]);
const guestRoom = makeRoom([makeParticipant(OTHER), makeParticipant(ME)]);

beforeEach(() => {
  vi.clearAllMocks();
  current = makeUseRoom();
  mocks.useRoom.mockImplementation(() => current);
});

describe("vue de l'hôte (SALLE-10)", () => {
  it.each(["fr", "en"] as const)("réglages modifiables, sans note « hôte seulement » (%s)", (locale) => {
    current = makeUseRoom({ room: hostRoom });
    const { labels, settingsLabels } = renderRoom({ locale });

    const timeLimit = screen.getByRole("radiogroup", { name: settingsLabels.timeLimit.label });
    for (const radio of within(timeLimit).getAllByRole("radio")) expect(radio).toBeEnabled();
    expect(screen.getByRole("textbox", { name: settingsLabels.excludedChars.label })).not.toHaveAttribute("readonly");
    expect(screen.queryByText(labels.config.hostOnly)).not.toBeInTheDocument();
  });

  it("envoie le patch du protocole quand l'hôte change une valeur", () => {
    const updateConfig = vi.fn<UseRoom["updateConfig"]>(async () => ({ ok: true, data: undefined }));
    current = makeUseRoom({ room: hostRoom, updateConfig });
    const { settingsLabels } = renderRoom();

    const timeLimit = screen.getByRole("radiogroup", { name: settingsLabels.timeLimit.label });
    fireEvent.click(within(timeLimit).getByRole("radio", { name: "2 min" }));
    fireEvent.click(within(timeLimit).getByRole("radio", { name: settingsLabels.timeLimit.none }));
    fireEvent.click(screen.getByRole("radio", { name: settingsLabels.language.en }));

    expect(updateConfig.mock.calls).toEqual([
      [{ timeLimitSeconds: 120 }],
      [{ timeLimitSeconds: null }],
      [{ language: "en" }],
    ]);
  });

  it("ne propose ni « Lancer la course » ni « Ajouter un joueur » (hors périmètre)", () => {
    current = makeUseRoom({ room: hostRoom });
    renderRoom();
    expect(screen.queryByText(/lancer/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/ajouter/i)).not.toBeInTheDocument();
  });
});

describe("vue d'un participant", () => {
  it("configuration en lecture seule : contrôles inactifs, valeur affichée et note", () => {
    current = makeUseRoom({ room: makeRoom(guestRoom.participants, { config: { ...guestRoom.config, language: "en" } }) });
    const { labels, settingsLabels } = renderRoom();

    const english = screen.getByRole("radio", { name: settingsLabels.language.en });
    expect(english).toHaveAttribute("aria-checked", "true");
    expect(english).toBeDisabled();
    expect(screen.getByRole("textbox", { name: settingsLabels.excludedChars.label })).toHaveAttribute("readonly");
    expect(screen.getByText(labels.config.hostOnly)).toBeVisible();
  });
});

describe("liste des participants (SALLE-7)", () => {
  it("affiche nom, rôle, badge hôte, « toi » et déconnecté dans une zone aria-live", () => {
    current = makeUseRoom({ room: hostRoom });
    const { labels } = renderRoom();

    const list = screen.getByRole("list", { name: labels.participants.title });
    expect(list).toHaveAttribute("aria-live", "polite");
    const [alice, bob] = within(list).getAllByRole("listitem");
    expect(alice).toHaveTextContent("Alice");
    expect(alice).toHaveTextContent(labels.participants.host);
    expect(alice).toHaveTextContent(labels.participants.you);
    expect(alice).toHaveTextContent(labels.participants.runner);
    expect(alice).not.toHaveTextContent(labels.participants.disconnected);
    expect(bob).toHaveTextContent("Bob");
    expect(bob).toHaveTextContent(labels.participants.spectator);
    expect(bob).toHaveTextContent(labels.participants.disconnected);
    expect(bob).not.toHaveTextContent(labels.participants.host);
    expect(bob).not.toHaveTextContent(labels.participants.you);
  });

  it("compte les coureurs (pas les spectateurs) sur le plafond", () => {
    current = makeUseRoom({ room: hostRoom });
    renderRoom({ locale: "en" });
    expect(screen.getByText("1/20 runners")).toBeVisible();
  });

  it.each(["fr", "en"] as const)("affiche le badge invité pour un participant invité (%s)", (locale) => {
    const guestRoom = makeRoom([makeParticipant(ME), makeParticipant(OTHER, { kind: "guest" })]);
    current = makeUseRoom({ room: guestRoom });
    const { labels } = renderRoom({ locale });

    const list = screen.getByRole("list", { name: labels.participants.title });
    const [alice, bob] = within(list).getAllByRole("listitem");
    expect(alice).not.toHaveTextContent(labels.participants.guest);
    expect(bob).toHaveTextContent(labels.participants.guest);
  });
});

describe("rejoindre au chargement (D6)", () => {
  it("émet un seul join avec le code et le rôle de l'URL quand le socket est connecté", async () => {
    const join = vi.fn<UseRoom["join"]>(async () => ({ ok: true, data: { code: "ABC234" } }));
    current = makeUseRoom({ join });
    const view = renderRoom({ role: "spectator" });

    await waitFor(() => expect(join).toHaveBeenCalledTimes(1));
    expect(join).toHaveBeenCalledWith({ code: "ABC234", role: "spectator" });
    view.rerender(view.ui());
    view.rerender(view.ui());
    expect(join).toHaveBeenCalledTimes(1);
  });

  it("attend la connexion avant d'émettre", async () => {
    const join = vi.fn<UseRoom["join"]>(async () => ({ ok: true, data: { code: "ABC234" } }));
    current = makeUseRoom({ join, connection: "connecting" });
    const view = renderRoom();
    expect(join).not.toHaveBeenCalled();
    expect(screen.getByText(view.labels.loading)).toBeVisible();

    setRoom(makeUseRoom({ join, connection: "connected" }), () => view.rerender(view.ui()));
    await waitFor(() => expect(join).toHaveBeenCalledTimes(1));
  });

  it("n'émet pas de join quand l'état courant est déjà cette salle", () => {
    const join = vi.fn<UseRoom["join"]>();
    current = makeUseRoom({ join, room: hostRoom });
    renderRoom();
    expect(join).not.toHaveBeenCalled();
  });

  it("n'émet pas de join pour un code mal formé : message INVALID_CODE", () => {
    const join = vi.fn<UseRoom["join"]>();
    current = makeUseRoom({ join });
    const { labels } = renderRoom({ code: "ABC" });
    expect(join).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(labels.errors.INVALID_CODE);
  });

  it("ne rejoint plus jamais après avoir quitté : pas de participant fantôme", async () => {
    const join = vi.fn<UseRoom["join"]>(async () => ({ ok: true, data: { code: "ABC234" } }));
    const leave = vi.fn<UseRoom["leave"]>(async () => ({ ok: true, data: undefined }));
    current = makeUseRoom({ join, leave, room: hostRoom });
    const view = renderRoom();

    fireEvent.click(screen.getByRole("button", { name: view.labels.leave }));
    await waitFor(() => expect(leave).toHaveBeenCalledTimes(1));
    // Le store passe à « hors salle » : c'est précisément le cas qui rejouait un join.
    setRoom(makeUseRoom({ join, leave, room: null }), () => view.rerender(view.ui()));
    view.rerender(view.ui());

    expect(join).not.toHaveBeenCalled();
  });

  it("ne rejoint pas non plus quand l'état devient null après un join déjà émis", async () => {
    const join = vi.fn<UseRoom["join"]>(async () => ({ ok: true, data: { code: "ABC234" } }));
    current = makeUseRoom({ join });
    const view = renderRoom();
    await waitFor(() => expect(join).toHaveBeenCalledTimes(1));

    setRoom(makeUseRoom({ join, room: hostRoom }), () => view.rerender(view.ui()));
    setRoom(makeUseRoom({ join, room: null }), () => view.rerender(view.ui()));

    expect(join).toHaveBeenCalledTimes(1);
  });
});

describe("quitter (D7, SALLE-15)", () => {
  it("quitte la salle puis remplace l'adresse par /play dans la langue courante", async () => {
    const leave = vi.fn<UseRoom["leave"]>(async () => ({ ok: true, data: undefined }));
    current = makeUseRoom({ leave, room: hostRoom });
    const { labels } = renderRoom({ locale: "en" });

    fireEvent.click(screen.getByRole("button", { name: labels.leave }));

    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/en/play"));
    expect(leave).toHaveBeenCalledTimes(1);
  });

  it("reste sur la salle et affiche l'erreur traduite si le départ échoue", async () => {
    const leave = vi.fn<UseRoom["leave"]>(async () => ({ ok: false, error: "TIMEOUT" }));
    current = makeUseRoom({ leave, room: hostRoom });
    const view = renderRoom();

    fireEvent.click(screen.getByRole("button", { name: view.labels.leave }));
    await waitFor(() => expect(leave).toHaveBeenCalled());
    setRoom(makeUseRoom({ leave, room: hostRoom, error: "TIMEOUT" }), () => view.rerender(view.ui()));

    expect(mocks.replace).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(view.labels.errors.TIMEOUT);
    expect(screen.getByRole("button", { name: view.labels.leave })).toBeEnabled();
  });

  it("n'est plus dans la salle (retiré, ou parti d'un autre onglet) : message et lien vers /play", () => {
    current = makeUseRoom({ room: hostRoom });
    const view = renderRoom();
    setRoom(makeUseRoom({ room: null }), () => view.rerender(view.ui()));

    expect(screen.getByRole("alert")).toHaveTextContent(view.labels.errors.NOT_IN_ROOM);
    expect(screen.getByRole("link", { name: view.labels.back })).toHaveAttribute("href", "/fr/play");
  });
});

describe("refus du serveur : message traduit, jamais le code brut", () => {
  it.each([
    ["ROOM_NOT_FOUND", "fr"],
    ["ROOM_FULL", "fr"],
    ["INVALID_CODE", "en"],
    ["ALREADY_IN_ROOM", "en"],
  ] as const)("join refusé (%s, %s) : message et lien vers /play", async (code, locale) => {
    const join = vi.fn<UseRoom["join"]>(async () => ({ ok: false, error: code }));
    current = makeUseRoom({ join });
    const { labels } = renderRoom({ locale });

    expect(await screen.findByRole("alert")).toHaveTextContent(labels.errors[code]);
    expect(screen.queryByText(code)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: labels.back })).toHaveAttribute("href", `/${locale}/play`);
  });

  it("updateConfig refusé (NOT_HOST) : message traduit au-dessus de la salle", () => {
    current = makeUseRoom({ room: hostRoom, error: "NOT_HOST" });
    const { labels } = renderRoom({ locale: "en" });
    expect(screen.getByRole("alert")).toHaveTextContent(labels.errors.NOT_HOST);
    expect(screen.queryByText("NOT_HOST")).not.toBeInTheDocument();
  });

  it("chaque code d'erreur du protocole, plus OFFLINE et TIMEOUT, a un message non vide dans les deux langues", () => {
    for (const locale of ["fr", "en"] as const) {
      const { errors } = getDictionary(locale).room;
      for (const code of [...ROOM_ERROR_CODES, "OFFLINE", "TIMEOUT"] as const) {
        expect(errors[code].trim()).not.toBe("");
        expect(errors[code]).not.toBe(code);
      }
    }
  });
});

describe("join en échec passager (P2)", () => {
  it("TIMEOUT alors qu'on est en fait dans la salle : la salle s'affiche, pas « indisponible »", async () => {
    const join = vi.fn<UseRoom["join"]>(async () => ({ ok: false, error: "TIMEOUT" }));
    current = makeUseRoom({ join });
    const view = renderRoom();
    await waitFor(() => expect(join).toHaveBeenCalledTimes(1));
    await screen.findByRole("alert");

    setRoom(makeUseRoom({ join, room: hostRoom }), () => view.rerender(view.ui()));

    expect(screen.queryByRole("link", { name: view.labels.back })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: view.labels.title })).toBeVisible();
  });

  it("réessaie une seule fois à la prochaine connexion", async () => {
    const join = vi
      .fn<UseRoom["join"]>()
      .mockResolvedValueOnce({ ok: false, error: "TIMEOUT" })
      .mockResolvedValueOnce({ ok: false, error: "OFFLINE" })
      .mockResolvedValue({ ok: true, data: { code: "ABC234" } });
    current = makeUseRoom({ join });
    const view = renderRoom();
    await waitFor(() => expect(join).toHaveBeenCalledTimes(1));

    setRoom(makeUseRoom({ join, connection: "offline" }), () => view.rerender(view.ui()));
    setRoom(makeUseRoom({ join, connection: "connected" }), () => view.rerender(view.ui()));
    await waitFor(() => expect(join).toHaveBeenCalledTimes(2));
    await screen.findByRole("alert");

    setRoom(makeUseRoom({ join, connection: "offline" }), () => view.rerender(view.ui()));
    setRoom(makeUseRoom({ join, connection: "connected" }), () => view.rerender(view.ui()));
    expect(join).toHaveBeenCalledTimes(2);
  });

  it("un refus définitif (ROOM_FULL) n'est pas réessayé", async () => {
    const join = vi.fn<UseRoom["join"]>(async () => ({ ok: false, error: "ROOM_FULL" }));
    current = makeUseRoom({ join });
    const view = renderRoom();
    await screen.findByRole("alert");

    setRoom(makeUseRoom({ join, connection: "offline" }), () => view.rerender(view.ui()));
    setRoom(makeUseRoom({ join, connection: "connected" }), () => view.rerender(view.ui()));
    expect(join).toHaveBeenCalledTimes(1);
  });

  it("un essai en attente ne rejoint plus une fois dans la salle ni après avoir quitté", async () => {
    const join = vi.fn<UseRoom["join"]>(async () => ({ ok: false, error: "TIMEOUT" }));
    const leave = vi.fn<UseRoom["leave"]>(async () => ({ ok: true, data: undefined }));
    current = makeUseRoom({ join, leave });
    const view = renderRoom();
    await waitFor(() => expect(join).toHaveBeenCalledTimes(1));

    setRoom(makeUseRoom({ join, leave, room: hostRoom }), () => view.rerender(view.ui()));
    fireEvent.click(screen.getByRole("button", { name: view.labels.leave }));
    await waitFor(() => expect(leave).toHaveBeenCalled());
    setRoom(makeUseRoom({ join, leave, room: null, connection: "offline" }), () => view.rerender(view.ui()));
    setRoom(makeUseRoom({ join, leave, room: null, connection: "connected" }), () => view.rerender(view.ui()));

    expect(join).toHaveBeenCalledTimes(1);
  });
});

describe("départ échoué pour une autre raison que TIMEOUT", () => {
  it("OFFLINE sur leave puis éviction : « NOT_IN_ROOM » affiché, pas de redirection silencieuse", async () => {
    const leave = vi.fn<UseRoom["leave"]>(async () => ({ ok: false, error: "OFFLINE" }));
    current = makeUseRoom({ leave, room: hostRoom });
    const view = renderRoom();

    fireEvent.click(screen.getByRole("button", { name: view.labels.leave }));
    await waitFor(() => expect(leave).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole("button", { name: view.labels.leave })).toBeEnabled());

    setRoom(makeUseRoom({ leave, room: null }), () => view.rerender(view.ui()));

    expect(screen.getByRole("alert")).toHaveTextContent(view.labels.errors.NOT_IN_ROOM);
    expect(mocks.replace).not.toHaveBeenCalled();
  });
});

describe("départ dont l'accusé se perd", () => {
  it("TIMEOUT sur leave puis état sans l'élève : retour à /play, pas « NOT_IN_ROOM »", async () => {
    const leave = vi.fn<UseRoom["leave"]>(async () => ({ ok: false, error: "TIMEOUT" }));
    current = makeUseRoom({ leave, room: hostRoom });
    const view = renderRoom();

    fireEvent.click(screen.getByRole("button", { name: view.labels.leave }));
    await waitFor(() => expect(leave).toHaveBeenCalled());
    expect(mocks.replace).not.toHaveBeenCalled();

    setRoom(makeUseRoom({ leave, room: null }), () => view.rerender(view.ui()));

    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/fr/play"));
    expect(mocks.replace).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(view.labels.errors.NOT_IN_ROOM)).not.toBeInTheDocument();
  });
});

describe("connexion", () => {
  it("trop d'onglets ouverts : bandeau traduit", () => {
    current = makeUseRoom({ connection: "tooManyConnections" });
    const { labels } = renderRoom({ locale: "en" });
    expect(screen.getByRole("status")).toHaveTextContent(labels.connection.tooManyConnections);
  });

  it("affiche le bandeau « Connexion perdue » quand le socket est hors ligne", () => {
    current = makeUseRoom({ room: hostRoom, connection: "offline" });
    const { labels } = renderRoom();
    expect(screen.getByRole("status")).toHaveTextContent(labels.connection.offline);
  });

  it("pas de bandeau quand tout va bien", () => {
    current = makeUseRoom({ room: hostRoom });
    const { labels } = renderRoom();
    expect(screen.queryByText(labels.connection.offline)).not.toBeInTheDocument();
  });

  it("session refusée par le service temps réel : redirige vers la connexion", () => {
    current = makeUseRoom({ connection: "unauthenticated" });
    renderRoom({ locale: "en" });
    expect(mocks.replace).toHaveBeenCalledWith("/en/login");
  });
});

describe("code de la salle (SALLE-4)", () => {
  it("affiche le code en grand et le copie, avec retour « Copié » annoncé", async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    current = makeUseRoom({ room: hostRoom });
    const { labels } = renderRoom();

    expect(screen.getByText("ABC234")).toBeVisible();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: labels.code.copy }));
    });

    expect(writeText).toHaveBeenCalledWith("ABC234");
    expect(screen.getByText(labels.code.copied)).toHaveAttribute("aria-live", "polite");
  });

  it("sans presse-papiers : sélectionne le code et le dit", async () => {
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
    current = makeUseRoom({ room: hostRoom });
    const { labels } = renderRoom();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: labels.code.copy }));
    });

    expect(screen.getByText(labels.code.copyFallback)).toBeVisible();
    expect(screen.queryByText(labels.code.copied)).not.toBeInTheDocument();
    expect(window.getSelection()?.toString()).toBe("ABC234");
  });
});
