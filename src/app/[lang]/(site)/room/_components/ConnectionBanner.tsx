import type { Dictionary } from "@/i18n/dictionaries";
import type { ConnectionStatus } from "@/realtime/roomConnection";

type ConnectionBannerProps = {
  status: ConnectionStatus;
  labels: Dictionary["room"]["connection"];
};

/**
 * Bandeau de connexion perdue (D9) ou d'onglets en trop. La zone `status` reste dans la page
 * pour que l'apparition du message soit annoncée par les lecteurs d'écran.
 */
export function ConnectionBanner({ status, labels }: ConnectionBannerProps) {
  const message =
    status === "offline" ? labels.offline : status === "tooManyConnections" ? labels.tooManyConnections : null;

  return (
    <div role="status">
      {message ? (
        <p className="rounded-field border border-danger bg-surface px-4 py-3 text-sm font-semibold text-danger">
          {message}
        </p>
      ) : null}
    </div>
  );
}
