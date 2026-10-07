"use client";

import { useState, useRef, useEffect } from "react";
import { X, User, Activity, Award, Trophy } from "lucide-react";
import type { CurrentUser } from "@/auth/types";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { ButtonLink } from "./ButtonLink";

type ProfileModalProps = {
  user: CurrentUser;
  dictionary: Dictionary;
  locale: Locale;
  children: React.ReactNode;
};

export function ProfileModal({ user, dictionary, locale, children }: ProfileModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  
  const dict = dictionary.profileDropdown;

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
        onClick={() => { console.log('Profile clicked!'); setIsOpen(true); }}
        className="cursor-pointer relative z-10 pointer-events-auto text-left hover:opacity-80 transition-opacity outline-none rounded-sm focus-visible:ring-2 focus-visible:ring-primary flex items-center"
      >
        {children}
      </button>

      <dialog 
        ref={dialogRef}
        className="backdrop:bg-surface/80 backdrop:backdrop-blur-sm bg-transparent w-full max-w-md m-auto p-4 rounded-xl shadow-2xl open:animate-in open:fade-in-0 open:zoom-in-95"
        onClick={(e) => {
          if (e.target === dialogRef.current) setIsOpen(false);
        }}
      >
        <div className="bg-surface border border-border rounded-xl p-6 relative flex flex-col gap-6 text-foreground" onClick={e => e.stopPropagation()}>
          <button 
            type="button" 
            onClick={() => setIsOpen(false)}
            className="absolute top-4 right-4 text-muted hover:text-foreground transition-colors"
            aria-label={dict.close}
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 border-b border-border pb-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <User className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold">{user.displayName}</h2>
              {user.kind === "guest" && (
                <span className="text-sm text-muted">{dictionary.header.guest}</span>
              )}
            </div>
          </div>

          {user.kind === "guest" ? (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 text-sm text-foreground/90">
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
                  <Activity className="w-5 h-5 text-primary" />
                  {dict.stats.title}
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-background rounded-lg p-3 border border-border">
                    <p className="text-xs text-muted mb-1 flex items-center gap-1"><Award className="w-3 h-3" />{dict.stats.racesPlayed}</p>
                    <p className="text-2xl font-bold">0</p>
                  </div>
                  <div className="bg-background rounded-lg p-3 border border-border">
                    <p className="text-xs text-muted mb-1 flex items-center gap-1"><Trophy className="w-3 h-3" />{dict.stats.victories}</p>
                    <p className="text-2xl font-bold">0</p>
                  </div>
                  <div className="bg-background rounded-lg p-3 border border-border col-span-2">
                    <p className="text-xs text-muted mb-1">{dict.stats.averageSpeed}</p>
                    <p className="text-xl font-bold">0 <span className="text-sm font-normal text-muted">MPM</span></p>
                  </div>
                </div>
                <p className="text-xs text-muted mt-3 text-center italic">{dict.stats.comingSoon}</p>
              </div>

              <div className="pt-2 border-t border-border mt-2">
                <ButtonLink href={`/${locale}/profile`} variant="secondary" className="w-full justify-center" onClick={() => setIsOpen(false)}>
                  {dict.viewFullProfile}
                </ButtonLink>
              </div>
            </div>
          )}
        </div>
      </dialog>
    </>
  );
}
