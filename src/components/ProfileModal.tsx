"use client";

import { useState, useRef, useEffect, useId } from "react";
import { X, Activity } from "lucide-react";
import type { CurrentUser } from "@/auth/types";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { getProfileSummary } from "@/app/[lang]/(site)/profile/statsActions";
import { Avatar } from "./Avatar";
import { ButtonLink } from "./ButtonLink";

type ProfileModalProps = {
  user: CurrentUser;
  dictionary: Dictionary;
  locale: Locale;
  children: React.ReactNode;
};

export function ProfileModal({ user, dictionary, locale, children }: ProfileModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof getProfileSummary>> | null>(null);
  const requestRef = useRef(0);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  
  const dict = dictionary.profileDropdown;
  const labels = dictionary.profile.stats;
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const percent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 });

  async function openProfile() {
    if (isOpen) return;
    setIsOpen(true);
    setSummary(null);
    if (user.kind !== "member") return;

    const request = ++requestRef.current;
    try {
      const result = await getProfileSummary();
      if (request === requestRef.current) setSummary(result);
    } catch {
      if (request === requestRef.current) setSummary({ ok: false });
    }
  }

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [isOpen]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    
    const handleClose = () => setIsOpen(false);
    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, []);

  return (
    <>
      <button 
        type="button" 
        onClick={openProfile}
        aria-haspopup="dialog"
        className="cursor-pointer relative z-10 pointer-events-auto text-left hover:opacity-80 transition-opacity outline-none rounded-sm focus-visible:ring-2 focus-visible:ring-accent flex items-center"
      >
        {children}
      </button>

      <dialog 
        ref={dialogRef}
        aria-labelledby={titleId}
        className="backdrop:bg-surface/80 backdrop:backdrop-blur-sm bg-transparent w-full max-w-md m-auto p-4 rounded-xl shadow-2xl open:animate-in open:fade-in-0 open:zoom-in-95"
        onClick={(e) => {
          if (e.target === dialogRef.current) setIsOpen(false);
        }}
      >
        {isOpen && (
          <div className="bg-surface border border-border rounded-xl p-6 relative flex flex-col gap-6 text-foreground" onClick={e => e.stopPropagation()}>
            <button 
              type="button" 
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 text-muted hover:text-foreground transition-colors"
              aria-label={dict.close}
            >
              <X aria-hidden="true" className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-border pb-4">
              <Avatar name={user.displayName} seed={user.id} userId={user.id} avatarVersion={user.avatarVersion} size={48} />
              <div className="min-w-0">
                <h2 id={titleId} className="[overflow-wrap:anywhere] text-xl font-bold">{user.displayName}</h2>
                {user.kind === "guest" && (
                  <span className="text-sm text-muted">{dictionary.header.guest}</span>
                )}
              </div>
            </div>

            {user.kind === "guest" ? (
              <div className="bg-accent-soft border border-border rounded-lg p-4 text-sm text-foreground">
                <p className="mb-4 leading-relaxed">{dict.guestWarning}</p>
                <div className="flex flex-wrap gap-2">
                  <ButtonLink href={`/${locale}/login`} variant="primary" onClick={() => setIsOpen(false)}>
                    {dict.login}
                  </ButtonLink>
                  <ButtonLink href={`/${locale}/register`} variant="secondary" onClick={() => setIsOpen(false)}>
                    {dict.register}
                  </ButtonLink>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div>
                  <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                    <Activity aria-hidden="true" className="w-5 h-5 text-accent-text" />
                    {dict.stats.title}
                  </h3>
                  <div aria-busy={summary === null} aria-live="polite">
                    {summary === null ? <p className="text-xs text-muted">{dict.stats.loading}</p>
                      : !summary.ok ? <p className="text-sm text-muted">{dict.stats.error}</p>
                      : summary.stats.raceCount === 0 ? <p className="text-sm text-muted">{dict.stats.empty}</p>
                      : <dl className="grid grid-cols-2 gap-3 text-sm">
                        {([
                          [labels.bestWpm, summary.stats.bestWpm === null ? labels.noValue : number.format(summary.stats.bestWpm)],
                          [labels.averageWpm, summary.stats.averageWpm === null ? labels.noValue : number.format(summary.stats.averageWpm)],
                          [labels.averageAccuracy, summary.stats.averageAccuracy === null ? labels.noValue : percent.format(summary.stats.averageAccuracy / 100)],
                          [labels.raceCount, number.format(summary.stats.raceCount)],
                          [labels.wins, number.format(summary.stats.wins)],
                        ]).map(([label, value]) => <div key={label}>
                          <dt className="text-muted">{label}</dt>
                          <dd className="font-semibold tabular-nums">{value}</dd>
                        </div>)}
                      </dl>}
                  </div>
                </div>

                <div className="pt-2 border-t border-border mt-2 flex flex-col gap-2">
                  <ButtonLink href={`/${locale}/profile`} variant="secondary" fullWidth onClick={() => setIsOpen(false)}>
                    {dict.viewFullProfile}
                  </ButtonLink>
                  <ButtonLink href={`/${locale}/history`} variant="secondary" fullWidth onClick={() => setIsOpen(false)}>
                    {dictionary.history.title}
                  </ButtonLink>
                </div>
              </div>
            )}
          </div>
        )}
      </dialog>
    </>
  );
}
