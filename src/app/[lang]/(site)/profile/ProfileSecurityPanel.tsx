import { LockKeyhole, Link as LinkIcon, ShieldCheck, KeyRound } from "lucide-react";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { GithubIcon } from "@/components/GithubIcon";
import { DiscordIcon } from "@/components/DiscordIcon";
import type { Dictionary } from "@/i18n/dictionaries";

type ProfileSecurityPanelProps = {
  hasPassword: boolean;
  hasGithub: boolean;
  hasDiscord: boolean;
  dictionary: Dictionary;
};

/** Colonne « comptes liés » et « sécurité » du profil : affichage seul (boutons désactivés), rendu côté serveur. */
export function ProfileSecurityPanel({ hasPassword, hasGithub, hasDiscord, dictionary }: ProfileSecurityPanelProps) {
  const { profile } = dictionary;

  return (
    <section className="flex flex-col gap-8 lg:col-span-5">
      <Card className="p-6 md:p-8 flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-accent-soft text-accent-text rounded-[10px]">
            <LinkIcon aria-hidden="true" className="w-6 h-6" />
          </div>
          <div className="flex flex-col">
            <h2 className="text-xl font-bold text-foreground">{profile.security.linkedAccounts}</h2>
            <p className="text-sm text-muted">{profile.security.linkedAccountsDesc}</p>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3 p-4 border border-border rounded-xl">
            <div className="flex items-center gap-3">
              <GithubIcon className="w-6 h-6 text-foreground" />
              <div className="flex flex-col">
                <p className="font-semibold text-sm text-foreground">{dictionary.oauth.github}</p>
                <div className="flex items-center gap-1.5 text-xs text-muted">
                  <div
                    aria-hidden="true"
                    className={`w-1.5 h-1.5 rounded-full ${hasGithub ? "bg-success" : "bg-muted"}`}
                  ></div>
                  {hasGithub ? profile.security.linked : profile.security.notLinked}
                </div>
              </div>
            </div>
            <Button variant="secondary" disabled>
              {hasGithub ? profile.security.unlink : profile.security.link}
            </Button>
          </div>

          <div className="flex items-center justify-between gap-3 p-4 border border-border rounded-xl">
            <div className="flex items-center gap-3">
              <DiscordIcon className="w-6 h-6" />
              <div className="flex flex-col">
                <p className="font-semibold text-sm text-foreground">{dictionary.oauth.discord}</p>
                <div className="flex items-center gap-1.5 text-xs text-muted">
                  <div
                    aria-hidden="true"
                    className={`w-1.5 h-1.5 rounded-full ${hasDiscord ? "bg-success" : "bg-muted"}`}
                  ></div>
                  {hasDiscord ? profile.security.linked : profile.security.notLinked}
                </div>
              </div>
            </div>
            <Button variant="secondary" disabled>
              {hasDiscord ? profile.security.unlink : profile.security.link}
            </Button>
          </div>

          <div className="flex items-start gap-3 text-muted text-xs mt-2 bg-surface p-4 rounded-xl border border-border">
            <ShieldCheck aria-hidden="true" className="w-5 h-5 shrink-0 text-accent-text" />
            <p className="leading-relaxed">{profile.security.privacy}</p>
          </div>
        </div>
      </Card>

      <Card className="p-6 md:p-8 flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-accent-soft text-accent-text rounded-[10px]">
            <LockKeyhole aria-hidden="true" className="w-6 h-6" />
          </div>
          <div className="flex flex-col">
            <h2 className="text-xl font-bold text-foreground">{profile.security.title}</h2>
            <p className="text-sm text-muted">{profile.security.description}</p>
          </div>
        </div>

        <div className="flex flex-col gap-5">
          {hasPassword ? (
            <>
              <p className="text-sm text-muted">{profile.security.hasPassword}</p>
              <Button variant="secondary" className="w-fit" disabled>
                <KeyRound aria-hidden="true" className="w-4 h-4" />
                {profile.security.changePassword}
              </Button>
            </>
          ) : (
            <div className="bg-accent-panel rounded-xl p-5 flex flex-col gap-4">
              <div>
                <Badge tone="surface">{profile.security.alternativeState}</Badge>
              </div>
              <p className="text-sm text-muted-strong leading-relaxed">{profile.security.noPassword}</p>
              <Button variant="secondary" className="w-fit" disabled>
                {profile.security.setPassword}
              </Button>
            </div>
          )}
        </div>
      </Card>
    </section>
  );
}
