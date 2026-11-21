"use client";

import { useEffect, useId, useRef } from "react";
import { Sparkles, X } from "lucide-react";
import { BlobCustomizer } from "@/app/[lang]/(site)/profile/BlobCustomizer";
import type { Dictionary } from "@/i18n/dictionaries";
import type { BlobStyle } from "@/race/blobStyle";

type RoomBlobModalProps = {
  open: boolean;
  initialStyle: BlobStyle;
  closeLabel: string;
  hintLabel: string;
  blobLabels: Dictionary["profile"]["blob"];
  onClose: () => void;
  onSaved?: (style: BlobStyle) => void;
};

/**
 * Fenêtre modale (`<dialog>`) de personnalisation du blob directement depuis la salle d'attente.
 */
export function RoomBlobModal({
  open,
  initialStyle,
  closeLabel,
  hintLabel,
  blobLabels,
  onClose,
  onSaved,
}: RoomBlobModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => onClose();
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [onClose]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      className="m-auto w-full max-w-4xl rounded-panel bg-transparent p-3 sm:p-6 backdrop:bg-screen/75 backdrop:backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
    >
      {open ? (
        <div
          className="relative flex max-h-[90vh] flex-col overflow-hidden rounded-panel border-2 border-screen-border bg-surface text-foreground shadow-soft"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="track-surface relative overflow-hidden border-b-2 border-screen-border px-6 py-5 text-track-line sm:px-8">
            <div aria-hidden="true" className="track-checker absolute inset-x-0 top-0 h-2.5 opacity-90" />
            <div className="mt-1 flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="room-blob-sparkle flex size-12 shrink-0 items-center justify-center rounded-field border-2 border-key-ink bg-key-yellow text-key-ink shadow-soft">
                  <Sparkles aria-hidden="true" className="size-6" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="inline-flex w-fit items-center rounded-full bg-key-mint px-2.5 py-0.5 text-xs font-extrabold uppercase tracking-wider text-key-ink">
                    {hintLabel}
                  </span>
                  <h2
                    id={titleId}
                    className="font-display text-2xl font-black uppercase tracking-tight text-track-line sm:text-3xl"
                  >
                    {blobLabels.title}
                  </h2>
                  <p className="text-sm text-track-line/90">{blobLabels.description}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label={closeLabel}
                className="inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-field border-2 border-key-ink bg-key-yellow text-key-ink transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-track-line"
              >
                <X aria-hidden="true" className="size-5" />
              </button>
            </div>
          </div>

          <div className="overflow-y-auto p-4 sm:p-6">
            <BlobCustomizer
              initialStyle={initialStyle}
              labels={blobLabels}
              showHeader={false}
              onSaved={onSaved}
            />
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
