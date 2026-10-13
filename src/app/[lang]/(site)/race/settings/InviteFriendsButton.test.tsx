import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDictionary } from "@/i18n/dictionaries";
import { DEFAULT_ROOM_CONFIG } from "@/realtime/protocol";
import type { UseRoom } from "@/realtime/useRoom";
import { makeUseRoom, ME } from "@/test/roomFixtures";
import { SettingsForm } from "./SettingsForm";

const mocks = vi.hoisted(() => ({
  useRoom: vi.fn<() => UseRoom>(),
  push: vi.fn(),
}));

vi.mock("@/realtime/useRoom", () => ({ useRoom: mocks.useRoom }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));

// Réglages par défaut de la page de paramètres, côté salle : les neuf clés du protocole.
const EXPECTED_CONFIG = {
  ...DEFAULT_ROOM_CONFIG,
  botCount: 2,
};

function renderMember(locale: "fr" | "en") {
  const { raceSettings, room } = getDictionary(locale);
  render(
    <SettingsForm lang={locale} dict={raceSettings} invite={{ kind: "member", userId: ME, roomErrors: room.errors }} />,
  );
  return { raceSettings, room };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.useRoom.mockImplementation(() => makeUseRoom());
});

describe.each(["fr", "en"] as const)("Inviter des amis, membre (%s)", (locale) => {
  it("creates the room with the chosen settings minus abilities, then opens it (AC-B1)", async () => {
    const create = vi.fn<UseRoom["create"]>(async () => ({ ok: true, data: { code: "XYZ789" } }));
    mocks.useRoom.mockImplementation(() => makeUseRoom({ create }));
    const { raceSettings } = renderMember(locale);

    fireEvent.click(screen.getByRole("radio", { name: raceSettings.textMode.words }));
    fireEvent.click(screen.getByRole("button", { name: raceSettings.invite.button }));

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith(`/${locale}/room/XYZ789`));
    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith({ ...EXPECTED_CONFIG, textMode: "words" });
    expect(create.mock.calls[0][0]).not.toHaveProperty("abilities");
  });

  it("disables the button while the call is pending", async () => {
    const create = vi.fn<UseRoom["create"]>(() => new Promise(() => undefined));
    mocks.useRoom.mockImplementation(() => makeUseRoom({ create }));
    const { raceSettings } = renderMember(locale);

    fireEvent.click(screen.getByRole("button", { name: raceSettings.invite.button }));

    await waitFor(() => expect(screen.getByRole("button", { name: raceSettings.invite.button })).toBeDisabled());
  });

  it("refused (ALREADY_IN_ROOM): translated error, no navigation, button usable again", async () => {
    const create = vi.fn<UseRoom["create"]>(async () => ({ ok: false, error: "ALREADY_IN_ROOM" }));
    mocks.useRoom.mockImplementation(() => makeUseRoom({ create }));
    const { raceSettings, room } = renderMember(locale);

    fireEvent.click(screen.getByRole("button", { name: raceSettings.invite.button }));

    expect(await screen.findByRole("alert")).toHaveTextContent(room.errors.ALREADY_IN_ROOM);
    expect(mocks.push).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: raceSettings.invite.button })).toBeEnabled();
  });

  it("too many excluded characters: validation error, nothing is sent", () => {
    const create = vi.fn<UseRoom["create"]>(async () => ({ ok: true, data: { code: "XYZ789" } }));
    mocks.useRoom.mockImplementation(() => makeUseRoom({ create }));
    const { raceSettings } = renderMember(locale);

    fireEvent.change(screen.getByRole("textbox", { name: raceSettings.excludedChars.label }), {
      target: { value: "a".repeat(101) },
    });
    fireEvent.click(screen.getByRole("button", { name: raceSettings.invite.button }));

    expect(create).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(raceSettings.excludedChars.error);
  });
});

describe.each(["fr", "en"] as const)("Inviter des amis, invité et visiteur (AC-B5) (%s)", (locale) => {
  it("guest: disabled button, reason linked to it, no room connection", () => {
    const { raceSettings } = getDictionary(locale);
    render(<SettingsForm lang={locale} dict={raceSettings} invite={{ kind: "guest" }} />);

    const button = screen.getByRole("button", { name: raceSettings.invite.button });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription(raceSettings.invite.guestNotice);
    expect(mocks.useRoom).not.toHaveBeenCalled();
  });

  it("visitor: disabled button, reason and a link to the login page", () => {
    const { raceSettings } = getDictionary(locale);
    render(<SettingsForm lang={locale} dict={raceSettings} invite={{ kind: "anonymous" }} />);

    const button = screen.getByRole("button", { name: raceSettings.invite.button });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription(expect.stringContaining(raceSettings.invite.anonymousNotice));
    expect(screen.getByRole("link", { name: raceSettings.invite.loginLink })).toHaveAttribute("href", `/${locale}/login`);
    expect(mocks.useRoom).not.toHaveBeenCalled();
  });

  it("without the invite prop: treated as a visitor", () => {
    const { raceSettings } = getDictionary(locale);
    render(<SettingsForm lang={locale} dict={raceSettings} />);
    expect(screen.getByRole("button", { name: raceSettings.invite.button })).toBeDisabled();
  });
});
