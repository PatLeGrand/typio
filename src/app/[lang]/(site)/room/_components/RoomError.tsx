import type { Dictionary } from "@/i18n/dictionaries";
import type { ClientRoomErrorCode } from "@/realtime/roomConnection";

type RoomErrorProps = {
  code: ClientRoomErrorCode;
  messages: Dictionary["room"]["errors"];
};

/** Refus ou échec affiché traduit : jamais le code brut (UI-5). */
export function RoomError({ code, messages }: RoomErrorProps) {
  return (
    <p role="alert" className="text-sm font-semibold text-danger">
      {messages[code]}
    </p>
  );
}
