"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { 
  LockKeyhole, 
  SlidersHorizontal, 
  Link as LinkIcon, 
  ShieldCheck, 
  KeyRound, 
  LogOut, 
  Save, 
  CircleAlert, 
  CircleCheck 
} from "lucide-react";

import { Button } from "@/components/Button";
import { TextField } from "@/components/TextField";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { ThemeToggle } from "@/components/ThemeToggle";
import { GithubIcon } from "@/components/GithubIcon";
import { DiscordIcon } from "@/components/DiscordIcon";
import { logout } from "@/auth/actions";
import { updateProfile } from "./actions";
import type { CurrentUser } from "@/auth/types";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";

type ProfileFormProps = {
  user: CurrentUser;
  dbUser: {
    createdAt: Date;
    keyboardLayout: string;
  };
  hasPassword: boolean;
  hasGithub: boolean;
  hasDiscord: boolean;
  dictionary: Dictionary;
  locale: Locale;
};

export function ProfileForm({ 
  user, 
  dbUser, 
  hasPassword, 
  hasGithub, 
  hasDiscord, 
  dictionary, 
  locale 
}: ProfileFormProps) {
  const router = useRouter();
  const { profile } = dictionary;
  
  const [displayName, setDisplayName] = useState(user.displayName);
  const [keyboardLayout, setKeyboardLayout] = useState(dbUser.keyboardLayout);
  const [formLocale, setFormLocale] = useState(locale);
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

  const hasChanges = displayName !== user.displayName || 
                     keyboardLayout !== dbUser.keyboardLayout || 
                     formLocale !== locale;
                     
  const isNameTooLong = displayName.length > 40;

  const handleSave = () => {
    if (isNameTooLong || displayName.trim() === "") return;
    
    startTransition(async () => {
      const formData = new FormData();
      formData.set("displayName", displayName);
      formData.set("keyboardLayout", keyboardLayout);
      formData.set("locale", formLocale);
      
      const res = await updateProfile(formData);
      if (res.status === "success") {
        setStatus("success");
        if (res.data?.locale && res.data.locale !== locale) {
          router.push(`/${res.data.locale}/profile`);
        }
      } else {
        setStatus("error");
      }
    });
  };

  const handleLogout = () => {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("locale", locale);
      await logout(fd);
    });
  };

  const formatter = new Intl.DateTimeFormat(locale, { dateStyle: "long" });
  const isGuest = user.kind === "guest";

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Top Banners */}
      {status === "success" && (
        <Card className="bg-key-mint/20 border-key-mint/40 p-4 flex gap-3 items-center text-foreground">
          <CircleCheck className="w-5 h-5 text-key-mint" />
          <p className="text-sm font-medium">Ton profil est à jour. Les modifications sont enregistrées.</p>
        </Card>
      )}

      {status === "error" && (
        <Card className="bg-key-coral/10 border-key-coral/30 p-4 flex gap-3 items-center text-foreground">
          <CircleAlert className="w-5 h-5 text-key-coral" />
          <p className="text-sm font-medium">Une erreur est survenue lors de l'enregistrement.</p>
        </Card>
      )}

      {isNameTooLong && (
        <Card className="bg-key-coral/10 border-key-coral/30 p-4 flex gap-3 items-center text-foreground">
          <CircleAlert className="w-5 h-5 text-key-coral" />
          <p className="text-sm font-medium">{profile?.actions?.fixErrors || "Corrige les erreurs pour enregistrer."}</p>
        </Card>
      )}

      {/* Main Grid: 2 columns for Members, centered narrow column for Guests */}
      <div className={`grid grid-cols-1 items-start gap-8 ${isGuest ? 'max-w-3xl mx-auto w-full' : 'lg:grid-cols-12'}`}>
        
        {/* Left Column */}
        <section className={`flex flex-col gap-8 ${isGuest ? '' : 'lg:col-span-7'}`}>
          <Card className="p-6 md:p-8 flex flex-col gap-8">
            <div className="flex items-center gap-5 border-b border-border pb-8">
              <Image 
                src="/images/mascotte-poulpe.png" 
                alt="Ton Blob" 
                width={72} 
                height={72} 
                className="bg-accent-panel rounded-full object-cover shrink-0"
              />
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-bold text-foreground">{user.displayName}</h2>
                  <Badge>{isGuest ? "Invité" : "Membre"}</Badge>
                </div>
                <p className="text-sm text-muted">
                  {profile?.identity?.memberSince || "Membre depuis le"} {formatter.format(dbUser.createdAt)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <TextField 
                  label={profile?.identity?.displayName || "Nom affiché"}
                  value={displayName}
                  onChange={(e) => { setDisplayName(e.target.value); setStatus("idle"); }}
                  error={isNameTooLong ? "Nom trop long" : undefined}
                />
                <div className="flex justify-between text-xs text-muted mt-1">
                  <span className={isNameTooLong ? "text-key-coral font-medium" : ""}>
                    {isNameTooLong 
                      ? "Retire " + (displayName.length - 40) + " caractères" 
                      : profile?.identity?.displayNameHelp || "40 caractères maximum"}
                  </span>
                  <span className={isNameTooLong ? "text-key-coral font-medium" : ""}>
                    {displayName.length} / 40
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <div className="relative">
                  <TextField 
                    label={profile?.identity?.username || "Nom d'utilisateur"}
                    value={user.username ? `@${user.username}` : "Invité"} 
                    disabled 
                    readOnly 
                  />
                  <LockKeyhole className="w-4 h-4 text-muted absolute right-4 top-1/2 -translate-y-1/2" />
                </div>
                <div className="flex justify-between text-xs text-muted mt-1">
                  <span>{profile?.identity?.usernameHelp || "Lecture seule · ton identifiant reste le même."}</span>
                  {user.username && <span>{user.username.length} / 20</span>}
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6 md:p-8 flex flex-col gap-8">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-accent-soft text-accent rounded-[10px]">
                <SlidersHorizontal className="w-6 h-6" />
              </div>
              <div className="flex flex-col">
                <h2 className="text-xl font-bold text-foreground">{profile?.settings?.title || "Préférences"}</h2>
                <p className="text-sm text-muted">{profile?.settings?.description || "Les bons réglages pour garder le rythme."}</p>
              </div>
            </div>

            <div className="flex flex-col gap-8">
              <div className="flex flex-col gap-3">
                <label className="text-sm font-semibold text-foreground">
                  {profile?.settings?.layout || "Disposition du clavier"}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {["qwerty", "azerty", "canadian"].map((layout) => (
                    <Button 
                      key={layout}
                      type="button"
                      variant={keyboardLayout === layout ? "primary" : "secondary"}
                      onClick={() => { setKeyboardLayout(layout); setStatus("idle"); }}
                      className="flex gap-2 items-center justify-center py-3"
                    >
                      {keyboardLayout === layout && <CircleCheck className="w-4 h-4" />}
                      {layout === "qwerty" ? "QWERTY" : layout === "azerty" ? "AZERTY" : "Canadien multilingue"}
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted">{profile?.settings?.layoutHelp || "Sert à calculer ta heatmap d'erreurs correctement"}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 border-t border-border pt-8">
                <div className="flex flex-col gap-3">
                  <label className="text-sm font-semibold text-foreground">
                    {profile?.settings?.language || "Langue de l'interface"}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["fr", "en"] as const).map((l) => (
                      <Button 
                        key={l}
                        type="button"
                        variant={formLocale === l ? "primary" : "secondary"}
                        onClick={() => { setFormLocale(l); setStatus("idle"); }}
                        className="flex gap-2 items-center justify-center"
                      >
                        {formLocale === l && <CircleCheck className="w-4 h-4" />}
                        {l === "fr" ? "Français" : "English"}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <label className="text-sm font-semibold text-foreground">
                    {profile?.settings?.theme || "Thème"}
                  </label>
                  <div className="w-full flex">
                    <ThemeToggle labels={dictionary.theme} compact={false} />
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </section>

        {/* Right Column (Only for Members) */}
        {!isGuest && (
          <section className="flex flex-col gap-8 lg:col-span-5">
            <Card className="p-6 md:p-8 flex flex-col gap-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-accent-soft text-accent rounded-[10px]">
                  <LinkIcon className="w-6 h-6" />
                </div>
                <div className="flex flex-col">
                  <h2 className="text-xl font-bold text-foreground">{profile?.security?.linkedAccounts || "Comptes reliés"}</h2>
                  <p className="text-sm text-muted">{profile?.security?.linkedAccountsDesc || "Tes autres portes d'entrée dans Typio."}</p>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between p-4 border border-border rounded-xl">
                  <div className="flex items-center gap-3">
                    <GithubIcon className="w-6 h-6 text-foreground" />
                    <div className="flex flex-col">
                      <p className="font-semibold text-sm text-foreground">GitHub</p>
                      <div className="flex items-center gap-1.5 text-xs text-muted">
                        <div className={`w-1.5 h-1.5 rounded-full ${hasGithub ? 'bg-success' : 'bg-muted'}`}></div>
                        {hasGithub ? "Relié" : "Non relié"}
                      </div>
                    </div>
                  </div>
                  <Button variant="secondary" disabled>
                    {hasGithub ? profile?.security?.unlink || "Délier" : profile?.security?.link || "Relier"}
                  </Button>
                </div>

                <div className="flex items-center justify-between p-4 border border-border rounded-xl">
                  <div className="flex items-center gap-3">
                    <DiscordIcon className="w-6 h-6" />
                    <div className="flex flex-col">
                      <p className="font-semibold text-sm text-foreground">Discord</p>
                      <div className="flex items-center gap-1.5 text-xs text-muted">
                        <div className={`w-1.5 h-1.5 rounded-full ${hasDiscord ? 'bg-success' : 'bg-muted'}`}></div>
                        {hasDiscord ? "Relié" : "Non relié"}
                      </div>
                    </div>
                  </div>
                  <Button variant="secondary" disabled>
                    {hasDiscord ? profile?.security?.unlink || "Délier" : profile?.security?.link || "Relier"}
                  </Button>
                </div>
                
                <div className="flex items-start gap-3 text-muted text-xs mt-2 bg-surface p-4 rounded-xl border border-border/50">
                  <ShieldCheck className="w-5 h-5 shrink-0 text-accent" />
                  <p className="leading-relaxed">{profile?.security?.privacy || "Seul l'identifiant du compte est conservé, sans e-mail ni avatar."}</p>
                </div>
              </div>
            </Card>

            <Card className="p-6 md:p-8 flex flex-col gap-6">
              <div className="flex items-center gap-4">
                 <div className="p-3 bg-accent-soft text-accent rounded-[10px]">
                  <LockKeyhole className="w-6 h-6" />
                </div>
                <div className="flex flex-col">
                  <h2 className="text-xl font-bold text-foreground">{profile?.security?.title || "Sécurité"}</h2>
                  <p className="text-sm text-muted">{profile?.security?.description || "Ton compte, bien à l'abri."}</p>
                </div>
              </div>

              <div className="flex flex-col gap-5">
                {hasPassword ? (
                  <>
                    <p className="text-sm text-muted">{profile?.security?.hasPassword || "Un mot de passe est défini pour ce compte."}</p>
                    <Button variant="secondary" className="w-fit flex gap-2" disabled>
                      <KeyRound className="w-4 h-4" />
                      {profile?.security?.changePassword || "Changer le mot de passe"}
                    </Button>
                  </>
                ) : (
                  <div className="bg-accent-panel rounded-xl p-5 flex flex-col gap-4">
                    <span className="w-fit uppercase text-[10px] tracking-wider font-bold p-2 bg-background rounded-full text-foreground border border-border">
                      État alternatif · GitHub ou Discord
                    </span>
                    <p className="text-sm text-muted-strong leading-relaxed">
                      {profile?.security?.noPassword || "Si ton compte a été créé via GitHub ou Discord, le mot de passe est facultatif. À la place :"}
                    </p>
                    <Button variant="secondary" className="w-fit flex gap-2 bg-surface hover:bg-surface/80 text-foreground" disabled>
                      {profile?.security?.setPassword || "Définir un mot de passe"}
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          </section>
        )}
      </div>

      {/* Actions du profil (Footer) */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-6 mt-8 pt-6 border-t border-border">
        <Button 
          variant="secondary" 
          className="flex gap-2 w-full sm:w-auto shrink-0" 
          onClick={handleLogout}
          disabled={isPending}
        >
          <LogOut className="w-4 h-4" />
          {profile?.actions?.logout || "Se déconnecter"}
        </Button>

        <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto justify-end">
          <span className="text-sm font-medium text-muted shrink-0 text-center sm:text-right">
            {isNameTooLong 
              ? <span className="text-key-coral">{profile?.actions?.fixErrors || "Corrige le nom pour enregistrer."}</span>
              : !hasChanges 
                ? (profile?.actions?.noChanges || "Aucun changement à enregistrer.") 
                : ""}
          </span>
          <div className="flex gap-3 w-full sm:w-auto">
            {hasChanges && (
              <Button 
                variant="secondary" 
                onClick={() => {
                  setDisplayName(user.displayName);
                  setKeyboardLayout(dbUser.keyboardLayout);
                  setFormLocale(locale);
                  setStatus("idle");
                }}
                disabled={isPending}
                className="flex-1 sm:flex-none shrink-0"
              >
                {profile?.actions?.cancel || "Annuler"}
              </Button>
            )}
            <Button 
              variant="primary" 
              className="flex gap-2 flex-1 sm:flex-none shrink-0 justify-center" 
              disabled={!hasChanges || isNameTooLong || isPending}
              onClick={handleSave}
            >
              <Save className="w-4 h-4 shrink-0" />
              {profile?.actions?.save || "Enregistrer"}
            </Button>
          </div>
        </div>
      </div>
      
      <p className="text-center text-sm text-muted py-6">
        {profile?.note || "Ces réglages te suivent dans toutes tes courses. À tes touches, prêt, pars !"}
      </p>
    </div>
  );
}
