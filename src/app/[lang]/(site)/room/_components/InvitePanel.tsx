"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import type { Dictionary } from "@/i18n/dictionaries";
import type { InviteInfo } from "@/realtime/protocol";
import type { ClientRoomErrorCode } from "@/realtime/roomConnection";

type InvitePanelProps = {
  invites: InviteInfo[];
  lang: string;
  labels: Dictionary["room"]["invites"];
  /** Messages d'erreur traduits, pour un échec de création (liste pleine, hors ligne…). */
  errors: Dictionary["room"]["errors"];
  /** Crée un lien ; le jeton en clair n'est renvoyé que cette fois (SALLE-04). */
  onCreate: () => Promise<{ ok: true; data: { id: string; token: string } } | { ok: false; error: ClientRoomErrorCode }>;
};

/**
 * Liens d'invitation, pour l'hôte (SALLE-04). Le lien en clair n'existe que dans la mémoire de
 * cette page, juste après sa création : pour un lien plus ancien, seul le statut est affiché.
 */
export function InvitePanel({ invites, lang, labels, errors, onCreate }: InvitePanelProps) {
  const [fresh, setFresh] = useState<{ id: string; url: string } | null>(null);
  const [feedback, setFeedback] = useState<"none" | "copied" | "failed">("none");
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<ClientRoomErrorCode | null>(null);

  async function create(): Promise<void> {
    setPending(true);
    setFeedback("none");
    setFailure(null);
    try {
      const result = await onCreate();
      if (!result.ok) setFailure(result.error);
      else setFresh({ id: result.data.id, url: `${window.location.origin}/${lang}/invite/${result.data.token}` });
    } finally {
      setPending(false);
    }
  }

  async function copy(url: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(url);
      setFeedback("copied");
    } catch {
      setFeedback("failed");
    }
  }

  const dateFormat = new Intl.DateTimeFormat(lang, { dateStyle: "short", timeStyle: "short" });

  return (
    <Card className="flex flex-col gap-4 border border-border p-6">
      <h2 id="invites-title" className="text-lg font-bold text-foreground">{labels.title}</h2>
      <p className="text-sm text-muted-strong">{labels.intro}</p>
      <div>
        <Button variant="secondary" disabled={pending} onClick={() => void create()}>{labels.create}</Button>
      </div>
      <p aria-live="polite" className="text-sm font-semibold text-success">
        {feedback === "copied" ? labels.copied : null}
      </p>
      {failure ? <p role="alert" className="text-sm font-semibold text-danger">{errors[failure]}</p> : null}
      {feedback === "failed" ? <p role="alert" className="text-sm font-semibold text-danger">{labels.copyFailed}</p> : null}
      {invites.length === 0 ? <p className="text-sm text-muted-strong">{labels.empty}</p> : (
        <ul aria-labelledby="invites-title" className="flex flex-col gap-2">
          {invites.map((invite, index) => (
            <li key={invite.id} className="flex flex-col gap-2 rounded-field border border-border px-4 py-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-semibold text-foreground">{labels.item.replace("{number}", String(index + 1))}</span>
                <span className="text-sm text-muted-strong">{labels.created.replace("{date}", dateFormat.format(invite.createdAt))}</span>
                <span className="text-sm font-semibold text-foreground">
                  {invite.status === "used" ? labels.used.replace("{name}", invite.usedBy ?? "") : labels[invite.status]}
                </span>
                {fresh?.id === invite.id && invite.status === "unused" ? (
                  <Button variant="secondary" className="ml-auto" onClick={() => void copy(fresh.url)}>{labels.copy}</Button>
                ) : null}
              </div>
              {fresh?.id === invite.id && invite.status === "unused" ? (
                <>
                  <p className="text-sm text-muted-strong">{labels.newLink}</p>
                  <p className="break-all font-mono text-sm text-foreground">{fresh.url}</p>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
