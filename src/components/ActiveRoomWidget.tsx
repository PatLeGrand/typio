"use client";

import { usePathname } from "next/navigation";
import { useCallback, useState } from "react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { roomPath } from "@/realtime/roomRoute";
import { useRoom } from "@/realtime/useRoom";
import { Button } from "./Button";
import { ButtonLink } from "./ButtonLink";
import { Card } from "./Card";

type Props = {
  userId: string;
  roomCode: string;
  locale: Locale;
  labels: Dictionary["activeRoom"];
};

export function ActiveRoomWidget(props: Props) {
  const pathname = usePathname();
  // Séparer le lecteur du chemin du lecteur de salle : aucun useRoom sur ces pages.
  if (pathname === `/${props.locale}/race` || pathname === roomPath(props.locale, props.roomCode)) return null;
  return <ConnectedActiveRoomWidget {...props} pathname={pathname} />;
}

function ConnectedActiveRoomWidget({ userId, locale, labels, pathname }: Props & { pathname: string }) {
  const { room, leave, connection } = useRoom(userId);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const reserveSpace = useCallback((node: HTMLDivElement | null) => {
    const panel = node?.firstElementChild;
    if (!node || !panel || typeof ResizeObserver === "undefined") return;
    // Placé après le footer : ses liens restent accessibles au défilement maximal.
    const observer = new ResizeObserver(() => {
      node.style.height = `${panel.getBoundingClientRect().height + 32}px`;
    });
    observer.observe(panel);
    return () => observer.disconnect();
  }, []);
  if (!room || room.status === "closed" || pathname === roomPath(locale, room.code)) return null;
  const racing = room.status === "countdown" || room.status === "racing";
  if (room.solo && !racing) return null;
  const message = racing ? labels.racing : room.status === "results" ? labels.results : labels.waiting;
  const role = room.participants.find((participant) => participant.userId === userId)?.role;

  async function handleLeave() {
    if (racing && role === "runner" && !window.confirm(labels.confirmLeave)) return;
    setPending(true);
    setFailed(false);
    const result = await leave();
    setPending(false);
    setFailed(!result.ok);
  }

  return (
    <div ref={reserveSpace}>
      <aside aria-label={labels.label} className="pointer-events-none fixed inset-x-4 bottom-4 z-40 sm:left-auto sm:w-80">
        <Card className="pointer-events-auto border border-border p-4 text-foreground">
          <p className="break-words font-semibold text-balance">
            {message.split("{code}").map((part, index) => <span key={index}>{index > 0 ? <span translate="no">{room.code}</span> : null}{part}</span>)}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <ButtonLink href={roomPath(locale, room.code, role)}>{labels.return}</ButtonLink>
            <Button variant="ghost" disabled={pending || connection !== "connected"} onClick={() => void handleLeave()}>
              {pending ? labels.leaving : labels.leave}
            </Button>
          </div>
          {failed ? <p role="alert" className="mt-2 text-sm text-danger">{labels.leaveError}</p> : null}
        </Card>
      </aside>
    </div>
  );
}
