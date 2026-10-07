import type { CurrentUser } from "@/auth/types";
import { Button } from "@/components/Button";
import { ButtonLink } from "@/components/ButtonLink";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";

type HomeCallToActionProps = {
  home: Dictionary["home"];
  locale: Locale;
  user: CurrentUser | null;
};

export function HomeCallToAction({ home, locale, user }: HomeCallToActionProps) {
  const canRegister = user === null || user.kind === "guest";

  return (
    <section className="bg-surface px-4 pb-16 sm:px-8 sm:pb-[88px]" aria-labelledby="cta-title">
      <div className="mx-auto flex w-full max-w-[1264px] flex-col items-center gap-6 rounded-[28px] bg-island-sand px-6 py-14 text-center sm:px-16 sm:py-16">
        <div className="flex max-w-[700px] flex-col gap-4">
          <h2 id="cta-title" className="text-3xl font-medium leading-[1.16] tracking-tight text-foreground sm:text-[42px]">
            {home.cta.title}
          </h2>
          <p className="text-base leading-[1.65] text-muted sm:text-lg">{home.cta.description}</p>
        </div>
        {canRegister ? (
          <ButtonLink href={`/${locale}/register`}>{home.signUp}</ButtonLink>
        ) : (
          <ButtonLink href={`/${locale}/play`}>{home.createRace}</ButtonLink>
        )}
        {user === null ? (
          <p className="text-sm text-muted">
            {home.cta.existingAccount}{" "}
            <ButtonLink href={`/${locale}/login`} variant="ghost">
              {home.signIn}
            </ButtonLink>
          </p>
        ) : null}
      </div>
    </section>
  );
}
