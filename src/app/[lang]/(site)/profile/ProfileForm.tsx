"use client";

import { useState, useTransition, type FormEvent } from "react";
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
  CircleCheck,
} from "lucide-react";

import { Button } from "@/components/Button";
import { TextField } from "@/components/TextField";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { ThemeToggle } from "@/components/ThemeToggle";
import { GithubIcon } from "@/components/GithubIcon";
import { DiscordIcon } from "@/components/DiscordIcon";
import { logout } from "@/auth/actions";
import { AUTH_FIELDS, type CurrentUser } from "@/auth/types";
import { PSEUDO_MAX_LENGTH, validatePseudo } from "@/auth/validation";
import { locales, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { prefixWithLocale } from "@/i18n/paths";
import { profileErrorMessage } from "@/profile/profileErrors";
import { KEYBOARD_LAYOUTS, type KeyboardLayout, type ProfileErrorCode } from "@/profile/profileSettings";
import { updateProfile } from "./actions";
import { ChoiceRadio } from "./ChoiceRadio";

type ProfileFormProps = {
  user: CurrentUser;
  dbUser: {
    createdAt: Date;
    keyboardLayout: KeyboardLayout;
  };
  hasPassword: boolean;
  hasGithub: boolean;
  hasDiscord: boolean;
  dictionary: Dictionary;
  locale: Locale;
};

const PROFILE_FORM_ID = "profile-form";
/** Codes qui concernent le champ du nom affiché ; les autres s'affichent dans la bannière. */
const PSEUDO_ERROR_CODES: readonly ProfileErrorCode[] = ["INVALID_PSEUDO", "PSEUDO_TAKEN"];

export function ProfileForm({
  user,
  dbUser,
  hasPassword,
  hasGithub,
  hasDiscord,
  dictionary,
  locale,
}: ProfileFormProps) {
  const router = useRouter();
  const { profile } = dictionary;

  const [displayName, setDisplayName] = useState(user.displayName);
  const [nameTouched, setNameTouched] = useState(false);
  const [keyboardLayout, setKeyboardLayout] = useState<KeyboardLayout>(dbUser.keyboardLayout);
  const [formLocale, setFormLocale] = useState<Locale>(locale);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [errorCode, setErrorCode] = useState<ProfileErrorCode | null>(null);

  const hasChanges =
    displayName.trim() !== user.displayName || keyboardLayout !== dbUser.keyboardLayout || formLocale !== locale;
  const nameIsValid = validatePseudo(displayName).ok;
  // Même mesure que `validatePseudo` : après rognage et NFC, en points de code.
  const nameLength = Array.from(displayName.trim().normalize("NFC")).length;

  // L'erreur du champ vient du serveur (nom déjà pris...) ou de la saisie, une fois le champ quitté.
  const serverNameError = errorCode !== null && PSEUDO_ERROR_CODES.includes(errorCode) ? errorCode : null;
  const nameError = serverNameError ?? (nameTouched && !nameIsValid ? "INVALID_PSEUDO" : null);
  const bannerError = errorCode !== null && serverNameError === null ? errorCode : null;

  const clearStatus = () => {
    setSaved(false);
    setErrorCode(null);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNameTouched(true);
    if (!hasChanges || !nameIsValid || isPending) return;

    // Construit depuis l'état, pas depuis le formulaire : le sélecteur de thème (des boutons radio) s'y trouve aussi.
    const formData = new FormData();
    formData.set("displayName", displayName);
    formData.set("keyboardLayout", keyboardLayout);
    formData.set("locale", formLocale);
    startTransition(async () => {
      const result = await updateProfile(formData);
      if (result.ok) {
        setSaved(true);
        setErrorCode(null);
        if (result.locale !== locale) router.push(prefixWithLocale("/profile", result.locale));
      } else {
        setSaved(false);
        setErrorCode(result.code);
      }
    });
  };

  const handleReset = () => {
    setDisplayName(user.displayName);
    setNameTouched(false);
    setKeyboardLayout(dbUser.keyboardLayout);
    setFormLocale(locale);
    clearStatus();
  };

  const formatter = new Intl.DateTimeFormat(locale, { dateStyle: "long" });
  const isGuest = user.kind === "guest";

  return (
    <div className="flex flex-col gap-6 w-full">
      {saved && (
        <Card role="status" className="border border-success p-4 flex gap-3 items-center text-foreground">
          <CircleCheck aria-hidden="true" className="w-5 h-5 shrink-0 text-success" />
          <p className="text-sm font-medium">{profile.status.saved}</p>
        </Card>
      )}

      {bannerError !== null && (
        <Card role="alert" className="border border-danger p-4 flex gap-3 items-center text-foreground">
          <CircleAlert aria-hidden="true" className="w-5 h-5 shrink-0 text-danger" />
          <p className="text-sm font-medium">{profileErrorMessage(bannerError, dictionary)}</p>
        </Card>
      )}

      {/* Les champs éditables sont dans ce formulaire ; le bouton « Enregistrer » du pied de page s'y rattache par `form`. */}
      <form id={PROFILE_FORM_ID} onSubmit={handleSubmit} noValidate>
        {/* Deux colonnes pour un membre, une colonne centrée pour un invité. */}
        <div className={`grid grid-cols-1 items-start gap-8 ${isGuest ? "max-w-3xl mx-auto w-full" : "lg:grid-cols-12"}`}>
          <section className={`flex flex-col gap-8 ${isGuest ? "" : "lg:col-span-7"}`}>
            <Card className="p-6 md:p-8 flex flex-col gap-8">
              <div className="flex items-center gap-5 border-b border-border pb-8">
                <Image
                  src="/images/mascotte-poulpe.png"
                  alt=""
                  width={72}
                  height={72}
                  className="bg-accent-panel rounded-full object-cover shrink-0"
                />
                <div className="flex flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-2xl font-bold text-foreground">{user.displayName}</h2>
                    <Badge>{isGuest ? dictionary.header.guest : profile.identity.member}</Badge>
                  </div>
                  <p className="text-sm text-muted">
                    {profile.identity.memberSince} {formatter.format(dbUser.createdAt)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="flex flex-col gap-2">
                  <TextField
                    label={profile.identity.displayName}
                    name="displayName"
                    value={displayName}
                    autoComplete="nickname"
                    onChange={(event) => {
                      setDisplayName(event.target.value);
                      clearStatus();
                    }}
                    onBlur={() => setNameTouched(true)}
                    error={nameError === null ? undefined : profileErrorMessage(nameError, dictionary)}
                  />
                  <div className="flex justify-between text-xs text-muted">
                    <span>{profile.identity.displayNameHelp}</span>
                    <span className={nameLength > PSEUDO_MAX_LENGTH ? "text-danger font-medium" : ""}>
                      {nameLength} / {PSEUDO_MAX_LENGTH}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <TextField
                    label={profile.identity.username}
                    value={user.username ? `@${user.username}` : profile.identity.noUsername}
                    icon={<LockKeyhole />}
                    disabled
                    readOnly
                  />
                  <p className="text-xs text-muted">{profile.identity.usernameHelp}</p>
                </div>
              </div>
            </Card>

            <Card className="p-6 md:p-8 flex flex-col gap-8">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-accent-soft text-accent-text rounded-[10px]">
                  <SlidersHorizontal aria-hidden="true" className="w-6 h-6" />
                </div>
                <div className="flex flex-col">
                  <h2 className="text-xl font-bold text-foreground">{profile.settings.title}</h2>
                  <p className="text-sm text-muted">{profile.settings.description}</p>
                </div>
              </div>

              <div className="flex flex-col gap-8">
                <fieldset className="flex flex-col gap-3">
                  <legend className="text-sm font-semibold text-foreground mb-3">{profile.settings.layout}</legend>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {KEYBOARD_LAYOUTS.map((layout) => (
                      <ChoiceRadio
                        key={layout}
                        name="keyboardLayout"
                        value={layout}
                        label={profile.settings.layouts[layout]}
                        checked={keyboardLayout === layout}
                        onChange={() => {
                          setKeyboardLayout(layout);
                          clearStatus();
                        }}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-muted">{profile.settings.layoutHelp}</p>
                </fieldset>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 border-t border-border pt-8">
                  <fieldset className="flex flex-col gap-3">
                    <legend className="text-sm font-semibold text-foreground mb-3">{profile.settings.language}</legend>
                    <div className="grid grid-cols-2 gap-2">
                      {locales.map((option) => (
                        <ChoiceRadio
                          key={option}
                          name="locale"
                          value={option}
                          label={dictionary.language.names[option]}
                          checked={formLocale === option}
                          onChange={() => {
                            setFormLocale(option);
                            clearStatus();
                          }}
                        />
                      ))}
                    </div>
                  </fieldset>

                  <div className="flex flex-col gap-3">
                    <p className="text-sm font-semibold text-foreground">{profile.settings.theme}</p>
                    <div className="w-full flex">
                      <ThemeToggle labels={dictionary.theme} compact={false} />
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </section>

          {/* Colonne de droite : membres seulement. */}
          {!isGuest && (
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
                        <p className="font-semibold text-sm text-foreground">GitHub</p>
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
                        <p className="font-semibold text-sm text-foreground">Discord</p>
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
          )}
        </div>
      </form>

      {/* Pied de page : la déconnexion est un formulaire à part (pas de formulaire imbriqué). */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-6 mt-8 pt-6 border-t border-border">
        <form action={logout} className="w-full sm:w-auto">
          <input type="hidden" name={AUTH_FIELDS.locale} value={locale} />
          <Button type="submit" variant="secondary" fullWidth>
            <LogOut aria-hidden="true" className="w-4 h-4" />
            {profile.actions.logout}
          </Button>
        </form>

        <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto justify-end">
          <span className="text-sm font-medium text-muted shrink-0 text-center sm:text-right">
            {!nameIsValid ? (
              <span className="text-danger">{profile.actions.fixErrors}</span>
            ) : !hasChanges ? (
              profile.actions.noChanges
            ) : null}
          </span>
          <div className="flex gap-3 w-full sm:w-auto">
            {hasChanges && (
              <Button variant="secondary" onClick={handleReset} disabled={isPending} className="flex-1 sm:flex-none shrink-0">
                {profile.actions.cancel}
              </Button>
            )}
            <Button
              type="submit"
              form={PROFILE_FORM_ID}
              className="flex-1 sm:flex-none shrink-0"
              disabled={!hasChanges || !nameIsValid || isPending}
            >
              <Save aria-hidden="true" className="w-4 h-4 shrink-0" />
              {profile.actions.save}
            </Button>
          </div>
        </div>
      </div>

      <p className="text-center text-sm text-muted py-6">{profile.note}</p>
    </div>
  );
}
