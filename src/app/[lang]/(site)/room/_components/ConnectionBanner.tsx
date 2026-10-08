import type { ConnectionStatus } from "@/realtime/roomConnection";

type ConnectionBannerProps = {
  status: ConnectionStatus;
  /** Texte déjà traduit : « Connexion perdue, nouvelle tentative… ». */
  offlineLabel: string;
};

/**
 * Bandeau de connexion perdue (D9). La zone `status` reste dans la page pour que
 * l'apparition du message soit annoncée par les lecteurs d'écran.
 */
export function ConnectionBanner({ status, offlineLabel }: ConnectionBannerProps) {
  return (
    <div role="status">
      {status === "offline" ? (
        <p className="rounded-field border border-danger bg-surface px-4 py-3 text-sm font-semibold text-danger">
          {offlineLabel}
        </p>
      ) : null}
    </div>
  );
}
