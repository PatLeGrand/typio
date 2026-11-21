"use client";

import { useRef, useState, useTransition, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  User,
  LockKeyhole,
  SlidersHorizontal,
  BarChart3,
  ShieldCheck,
  LogOut,
  Save,
  CircleAlert,
  CircleCheck,
} from "lucide-react";

import { Button } from "@/components/Button";
import { TextField } from "@/components/TextField";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
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

type ProfileTabId = "profile" | "preferences" | "stats" | "security";

type ProfileFormProps = {
  user: CurrentUser;
  dbUser: {
    createdAt: Date;
    keyboardLayout: KeyboardLayout;
  };
  /** Formulaire photo de profil des membres, rendu hors du formulaire principal. */
  avatarPanel?: ReactNode;
  /** Carte « Mon blob de course », rendue dans la colonne latérale de l'onglet Profil. */
  blobPanel?: ReactNode;
  /** Panneau statistiques des membres, rendu côté serveur. */
  statsPanel?: ReactNode;
  /** Panneau sécurité et comptes reliés des membres, rendu côté serveur. */
  securityPanel: ReactNode;
  dictionary: Dictionary;
  locale: Locale;
};

const PROFILE_FORM_ID = "profile-form";
/** Codes qui concernent le champ du nom affiché ; les autres s'affichent dans la bannière. */
const PSEUDO_ERROR_CODES: readonly ProfileErrorCode[] = ["INVALID_PSEUDO", "PSEUDO_TAKEN"];

export function ProfileForm({
  user,
  dbUser,
  avatarPanel,
  blobPanel,
  statsPanel,
  securityPanel,
  dictionary,
  locale,
}: ProfileFormProps) {
  const router = useRouter();
  const { profile } = dictionary;

  const isGuest = user.kind === "guest";

  const [activeTab, setActiveTab] = useState<ProfileTabId>("profile");
  const tabRefs = useRef<Partial<Record<ProfileTabId, HTMLButtonElement | null>>>({});

  const [displayName, setDisplayName] = useState(user.displayName);
  const [nameTouched, setNameTouched] = useState(false);
  const [keyboardLayout, setKeyboardLayout] = useState<KeyboardLayout>(dbUser.keyboardLayout);
  const [formLocale, setFormLocale] = useState<Locale>(locale);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [errorCode, setErrorCode] = useState<ProfileErrorCode | null>(null);

  const profileTabHasChanges = displayName.trim() !== user.displayName;
  const preferencesTabHasChanges = keyboardLayout !== dbUser.keyboardLayout || formLocale !== locale;
  const hasChanges = profileTabHasChanges || preferencesTabHasChanges;
  const nameIsValid = validatePseudo(displayName).ok;
  // Même mesure que `validatePseudo` : après rognage et NFC, en points de code.
  const nameLength = Array.from(displayName.trim().normalize("NFC")).length;

  // L'erreur du champ vient du serveur (nom déjà pris...) ou de la saisie, une fois le champ quitté.
  const serverNameError = errorCode !== null && PSEUDO_ERROR_CODES.includes(errorCode) ? errorCode : null;
  const nameError = serverNameError ?? (nameTouched && !nameIsValid ? "INVALID_PSEUDO" : null);
  const bannerError = errorCode !== null && serverNameError === null ? errorCode : null;

  const tabs: {
    id: ProfileTabId;
    label: string;
    icon: typeof User;
    indicator: "error" | "dirty" | null;
  }[] = isGuest
    ? [
        {
          id: "profile",
          label: profile.tabs.profile,
          icon: User,
          indicator: nameError !== null ? "error" : profileTabHasChanges ? "dirty" : null,
        },
        {
          id: "preferences",
          label: profile.tabs.preferences,
          icon: SlidersHorizontal,
          indicator: preferencesTabHasChanges ? "dirty" : null,
        },
      ]
    : [
        {
          id: "profile",
          label: profile.tabs.profile,
          icon: User,
          indicator: nameError !== null ? "error" : profileTabHasChanges ? "dirty" : null,
        },
        {
          id: "preferences",
          label: profile.tabs.preferences,
          icon: SlidersHorizontal,
          indicator: preferencesTabHasChanges ? "dirty" : null,
        },
        {
          id: "stats",
          label: profile.tabs.stats,
          icon: BarChart3,
          indicator: null,
        },
        {
          id: "security",
          label: profile.tabs.security,
          icon: ShieldCheck,
          indicator: null,
        },
      ];

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") {
      nextIndex = (currentIndex + 1) % tabs.length;
    } else if (event.key === "ArrowLeft") {
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = tabs.length - 1;
    }
    if (nextIndex === null) return;

    event.preventDefault();
    const nextTab = tabs[nextIndex];
    setActiveTab(nextTab.id);
    tabRefs.current[nextTab.id]?.focus();
  };

  const clearStatus = () => {
    setSaved(false);
    setErrorCode(null);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNameTouched(true);
    if (!nameIsValid) {
      setActiveTab("profile");
      return;
    }
    if (user.isDemo || !hasChanges || isPending) return;

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
        if (PSEUDO_ERROR_CODES.includes(result.code)) {
          setActiveTab("profile");
        }
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

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Bandeau résumé compact, visible quel que soit l'onglet actif */}
      <Card className="p-5 md:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            {user.avatarVersion !== null ? (
              <Image
                src={`/api/avatars/${user.id}?v=${user.avatarVersion}`}
                alt=""
                width={64}
                height={64}
                unoptimized
                className="size-16 rounded-full object-cover border border-border shrink-0"
              />
            ) : (
              <Image
                src="/images/mascotte-poulpe.png"
                alt=""
                width={64}
                height={64}
                className="size-16 bg-accent-panel rounded-full object-cover shrink-0"
              />
            )}
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="min-w-0 [overflow-wrap:anywhere] text-xl md:text-2xl font-bold text-foreground">
                  {user.displayName}
                </h2>
                <Badge>{isGuest ? dictionary.header.guest : profile.identity.member}</Badge>
              </div>
              <p className="text-sm text-muted">
                {isGuest ? profile.identity.guestSince : profile.identity.memberSince} {formatter.format(dbUser.createdAt)}
              </p>
            </div>
          </div>
          {user.isDemo && (
            <p
              role="status"
              className="shrink-0 rounded-field border border-border bg-accent-soft px-3.5 py-2 text-xs font-medium text-accent-text"
            >
              {profile.demoReadOnly}
            </p>
          )}
        </div>
      </Card>

      {/* Barre d'onglets WAI-ARIA */}
      <div
        role="tablist"
        aria-label={profile.tabs.label}
        className="flex items-center gap-1.5 overflow-x-auto rounded-card border border-border bg-surface p-1.5 shadow-soft"
      >
        {tabs.map((tab, index) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              ref={(node) => {
                tabRefs.current[tab.id] = node;
              }}
              id={`profile-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`profile-panel-${tab.id}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
              className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-field px-4 py-2.5 text-sm font-semibold transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:flex-1 cursor-pointer ${
                isActive
                  ? "bg-accent text-accent-foreground shadow-soft"
                  : "text-muted hover:bg-accent-soft hover:text-foreground"
              }`}
            >
              <Icon aria-hidden="true" className="size-4 shrink-0" />
              <span>{tab.label}</span>
              {tab.indicator !== null && (
                <span
                  aria-hidden="true"
                  className={`size-2 rounded-full shrink-0 ${
                    tab.indicator === "error"
                      ? "bg-danger"
                      : isActive
                        ? "bg-accent-foreground"
                        : "bg-accent"
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Bannières de statut visibles quel que soit l'onglet */}
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

      {/* Onglet 1 : Profil */}
      <div
        id="profile-panel-profile"
        role="tabpanel"
        aria-labelledby="profile-tab-profile"
        hidden={activeTab !== "profile"}
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 items-start gap-6">
          <div className={`flex flex-col gap-6 ${blobPanel ? "lg:col-span-7" : "lg:col-span-12"}`}>
            {/* Formulaire principal : AvatarForm reste en dehors pour éviter tout formulaire imbriqué. */}
            <form id={PROFILE_FORM_ID} onSubmit={handleSubmit} noValidate>
              <Card className="p-6 md:p-8 flex flex-col gap-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-accent-soft text-accent-text rounded-[10px]">
                    <User aria-hidden="true" className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground">{profile.identity.title}</h3>
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
            </form>

            {!isGuest && avatarPanel}
          </div>

          {blobPanel && <div className="lg:col-span-5 flex flex-col gap-6">{blobPanel}</div>}
        </div>
      </div>

      {/* Onglet 2 : Préférences */}
      <div
        id="profile-panel-preferences"
        role="tabpanel"
        aria-labelledby="profile-tab-preferences"
        hidden={activeTab !== "preferences"}
      >
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
                    form={PROFILE_FORM_ID}
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

            <div className="grid grid-cols-1 gap-8 border-t border-border pt-8">
              <fieldset className="flex flex-col gap-3">
                <legend className="text-sm font-semibold text-foreground mb-3">{profile.settings.language}</legend>
                <div className="grid grid-cols-2 gap-2">
                  {locales.map((option) => (
                    <ChoiceRadio
                      key={option}
                      form={PROFILE_FORM_ID}
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
            </div>
          </div>
        </Card>
      </div>

      {/* Onglet 3 : Statistiques (membres uniquement) */}
      {!isGuest && (
        <div
          id="profile-panel-stats"
          role="tabpanel"
          aria-labelledby="profile-tab-stats"
          hidden={activeTab !== "stats"}
        >
          {statsPanel}
        </div>
      )}

      {/* Onglet 4 : Sécurité (membres uniquement) */}
      {!isGuest && (
        <div
          id="profile-panel-security"
          role="tabpanel"
          aria-labelledby="profile-tab-security"
          hidden={activeTab !== "security"}
        >
          {securityPanel}
        </div>
      )}

      {/* Pied de page : la déconnexion est un formulaire à part (pas de formulaire imbriqué). */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-6 mt-4 pt-6 border-t border-border">
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
              disabled={user.isDemo || !hasChanges || !nameIsValid || isPending}
            >
              <Save aria-hidden="true" className="w-4 h-4 shrink-0" />
              {profile.actions.save}
            </Button>
          </div>
        </div>
      </div>

      <p className="text-center text-sm text-muted py-4">{profile.note}</p>
    </div>
  );
}
