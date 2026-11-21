import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { getDictionary } from "@/i18n/dictionaries";
import { BLOB_COLORS, DEFAULT_BLOB_STYLE, type BlobStyle } from "@/race/blobStyle";
import { blobSvgDataUrl } from "@/race/blobSvg";
import { DEFAULT_ROOM_CONFIG } from "@/realtime/protocol";
import { plain } from "@/test/text";
import { makeParticipant, makeRoom, ME, OTHER } from "@/test/roomFixtures";
import { ParticipantList } from "./ParticipantList";

const dict = getDictionary("fr");
const labels = dict.room.participants;
const raceLabels = dict.raceScreen;

describe("ParticipantList", () => {
  it("affiche les blobs des joueurs humains (style personnalisé et repli sur DEFAULT_BLOB_STYLE)", () => {
    const customStyle: BlobStyle = { color: "coral", glasses: "star", hat: "crown" };
    const room = makeRoom([
      makeParticipant(ME, { displayName: "Alice", blobStyle: customStyle }),
      makeParticipant(OTHER, { displayName: "Bob", blobStyle: undefined }),
    ]);

    render(<ParticipantList room={room} currentUserId={ME} labels={labels} raceLabels={raceLabels} />);

    const list = screen.getByRole("list", { name: labels.title });
    expect(list).toHaveAttribute("aria-live", "polite");
    expect(list.className).toContain("grid");

    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(2);

    const aliceImg = items[0]?.querySelector("img");
    expect(aliceImg).not.toBeNull();
    expect(aliceImg?.getAttribute("src")).toBe(blobSvgDataUrl(customStyle));
    expect(aliceImg).toHaveAttribute("alt", "");
    expect(aliceImg).toHaveAttribute("aria-hidden", "true");
    expect(items[0]).toHaveTextContent("Alice");

    const bobImg = items[1]?.querySelector("img");
    expect(bobImg).not.toBeNull();
    expect(bobImg?.getAttribute("src")).toBe(blobSvgDataUrl(DEFAULT_BLOB_STYLE));
    expect(bobImg).toHaveAttribute("alt", "");
    expect(bobImg).toHaveAttribute("aria-hidden", "true");
    expect(items[1]).toHaveTextContent("Bob");
  });

  it("affiche les bots avec leur blob coloré, le badge BOT et leur niveau", () => {
    const room = makeRoom([makeParticipant(ME)], {
      config: { ...DEFAULT_ROOM_CONFIG, bots: ["beginner", "expert"] },
    });

    render(<ParticipantList room={room} currentUserId={ME} labels={labels} raceLabels={raceLabels} />);

    expect(screen.getByText("3/20 coureurs")).toBeVisible();

    const list = screen.getByRole("list", { name: labels.title });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(3);

    const bot1 = items[1]!;
    const bot1Img = bot1.querySelector("img");
    expect(bot1Img?.getAttribute("src")).toBe(
      blobSvgDataUrl({ color: BLOB_COLORS[1 % BLOB_COLORS.length], glasses: "none", hat: "none" }),
    );
    expect(bot1Img).toHaveAttribute("alt", "");
    expect(bot1Img).toHaveAttribute("aria-hidden", "true");
    expect(bot1).toHaveTextContent(raceLabels.bot);
    expect(bot1).toHaveTextContent(raceLabels.botLevels.beginner);

    const bot2 = items[2]!;
    const bot2Img = bot2.querySelector("img");
    expect(bot2Img?.getAttribute("src")).toBe(
      blobSvgDataUrl({ color: BLOB_COLORS[2 % BLOB_COLORS.length], glasses: "none", hat: "none" }),
    );
    expect(bot2Img).toHaveAttribute("alt", "");
    expect(bot2Img).toHaveAttribute("aria-hidden", "true");
    expect(bot2).toHaveTextContent(raceLabels.bot);
    expect(bot2).toHaveTextContent(raceLabels.botLevels.expert);
  });

  it("affiche les badges (HÔTE, TOI, INVITÉ), le rôle et l'état déconnecté, sans bouton d'expulsion si onKick est omis", () => {
    const room = makeRoom([
      makeParticipant(ME, { displayName: "Alice", role: "runner", connected: true }),
      makeParticipant(OTHER, { displayName: "Bob", kind: "guest", role: "spectator", connected: false }),
    ]);

    render(<ParticipantList room={room} currentUserId={ME} labels={labels} raceLabels={raceLabels} />);

    const [alice, bob] = screen.getAllByRole("listitem");
    expect(alice).toHaveTextContent(labels.host);
    expect(alice).toHaveTextContent(labels.you);
    expect(alice).toHaveTextContent(labels.runner);
    expect(alice).not.toHaveTextContent(labels.guest);
    expect(alice).not.toHaveTextContent(labels.disconnected);
    expect(alice?.querySelector("img")?.className).not.toContain("opacity-60");

    expect(bob).toHaveTextContent(labels.guest);
    expect(bob).toHaveTextContent(labels.spectator);
    expect(bob).toHaveTextContent(labels.disconnected);
    expect(bob).not.toHaveTextContent(labels.host);
    expect(bob).not.toHaveTextContent(labels.you);
    expect(bob?.querySelector("img")?.className).toContain("opacity-60");
    expect(screen.queryByRole("button", { name: labels.kick })).not.toBeInTheDocument();
  });

  it("gère le flux de confirmation et d'annulation d'expulsion pour l'hôte, sans bouton sur soi-même ni sur les bots (SALLE-07)", async () => {
    let resolveKick!: () => void;
    const onKick = vi.fn(() => new Promise<void>((resolve) => { resolveKick = resolve; }));
    const room = makeRoom(
      [
        makeParticipant(ME, { displayName: "Alice" }),
        makeParticipant(OTHER, { displayName: "Bob" }),
      ],
      { config: { ...DEFAULT_ROOM_CONFIG, bots: ["beginner"] } },
    );

    render(<ParticipantList room={room} currentUserId={ME} labels={labels} raceLabels={raceLabels} onKick={onKick} />);

    const [alice, bob, bot] = screen.getAllByRole("listitem");
    expect(within(alice!).queryByRole("button", { name: labels.kick })).not.toBeInTheDocument();
    expect(within(bot!).queryByRole("button", { name: labels.kick })).not.toBeInTheDocument();

    const kickBtn = within(bob!).getByRole("button", { name: labels.kick });
    fireEvent.click(kickBtn);

    const confirmText = labels.kickConfirm.replace("{name}", "Bob");
    const group = within(bob!).getByRole("group");
    expect(group).toHaveAttribute("aria-label", confirmText);
    expect(group).toHaveTextContent(plain(confirmText));

    fireEvent.click(within(group).getByRole("button", { name: labels.kickCancel }));
    expect(within(bob!).queryByRole("group")).not.toBeInTheDocument();
    expect(onKick).not.toHaveBeenCalled();

    fireEvent.click(within(bob!).getByRole("button", { name: labels.kick }));
    const groupAgain = within(bob!).getByRole("group");
    const yesBtn = within(groupAgain).getByRole("button", { name: labels.kickYes });
    const cancelBtn = within(groupAgain).getByRole("button", { name: labels.kickCancel });
    fireEvent.click(yesBtn);

    expect(yesBtn).toBeDisabled();
    expect(cancelBtn).toBeDisabled();
    expect(onKick).toHaveBeenCalledWith(OTHER);

    resolveKick();
    await waitFor(() => expect(within(bob!).queryByRole("group")).not.toBeInTheDocument());
  });
});
