import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { getDictionary } from "@/i18n/dictionaries";
import type { UseRoom } from "@/realtime/useRoom";
import { makeParticipant, makeRoom, makeUseRoom, ME } from "@/test/roomFixtures";
import { ActiveRoomWidget } from "./ActiveRoomWidget";

const mocks = vi.hoisted(() => ({ pathname: "/fr/privacy", useRoom: vi.fn<() => UseRoom>() }));
vi.mock("next/navigation", () => ({ usePathname: () => mocks.pathname }));
vi.mock("@/realtime/useRoom", () => ({ useRoom: mocks.useRoom }));
const labels = getDictionary("fr").activeRoom;
const room = makeRoom([makeParticipant(ME)]);
const widget = () => <ActiveRoomWidget userId={ME} roomCode={room.code} locale="fr" labels={labels} />;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.pathname = "/fr/privacy";
  mocks.useRoom.mockReturnValue(makeUseRoom({ room }));
});

it.each(["/fr/room/ABC234", "/fr/race"])("n'ouvre aucune connexion depuis %s", (pathname) => {
  mocks.pathname = pathname;
  render(widget());
  expect(mocks.useRoom).not.toHaveBeenCalled();
  expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
});

it.each([
  [false, "waiting", true], [false, "countdown", true], [false, "racing", true], [false, "results", true],
  [true, "waiting", false], [true, "countdown", true], [true, "racing", true], [true, "results", false],
  [false, "closed", false],
] as const)("visibilité solo=%s, statut=%s", (solo, status, visible) => {
  mocks.useRoom.mockReturnValue(makeUseRoom({ room: { ...room, solo, status } }));
  render(widget());
  expect(screen.queryByRole("complementary") !== null).toBe(visible);
  if (solo) expect(screen.queryByText(room.code)).not.toBeInTheDocument();
});

it("masque une salle disparue", () => {
  mocks.useRoom.mockReturnValue(makeUseRoom());
  render(widget());
  expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
});

it("retourne avec le rôle spectateur et disparaît après départ", async () => {
  const leave = vi.fn<UseRoom["leave"]>(async () => ({ ok: true, data: undefined }));
  mocks.useRoom.mockReturnValue(makeUseRoom({ room: { ...room, participants: [makeParticipant(ME, { role: "spectator" })] }, leave }));
  const view = render(widget());
  expect(screen.getByRole("link", { name: labels.return })).toHaveAttribute("href", "/fr/room/ABC234?role=spectator");
  fireEvent.click(screen.getByRole("button", { name: labels.leave }));
  await waitFor(() => expect(leave).toHaveBeenCalledOnce());
  mocks.useRoom.mockReturnValue(makeUseRoom());
  view.rerender(widget());
  expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
});

it("confirme l'abandon et affiche un échec réessayable", async () => {
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  const leave = vi.fn<UseRoom["leave"]>(async () => ({ ok: false, error: "TIMEOUT" }));
  mocks.useRoom.mockReturnValue(makeUseRoom({ room: { ...room, status: "racing" }, leave }));
  render(widget());
  fireEvent.click(screen.getByRole("button", { name: labels.leave }));
  expect(confirm).toHaveBeenCalledWith(labels.confirmLeave);
  expect(leave).not.toHaveBeenCalled();
  confirm.mockReturnValue(true);
  fireEvent.click(screen.getByRole("button", { name: labels.leave }));
  expect(await screen.findByRole("alert")).toHaveTextContent(labels.leaveError);
  expect(screen.getByRole("button", { name: labels.leave })).toBeEnabled();
  confirm.mockRestore();
});
