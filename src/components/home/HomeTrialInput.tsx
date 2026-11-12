import type { ComponentPropsWithRef } from "react";

type HomeTrialInputProps = {
  text: string;
  typed: string;
  inputLabel: string;
  hint: string;
  /** Propriétés natives du champ (valeur, gestionnaires, ref) : l'état reste dans `HomeRaceShowcase`. */
  inputProps: ComponentPropsWithRef<"input">;
};

/** Libellé, texte coloré caractère par caractère, champ de saisie et aides de l'essai de l'accueil. */
export function HomeTrialInput({ text, typed, inputLabel, hint, inputProps }: HomeTrialInputProps) {
  return (
    <>
      <label htmlFor="home-race-input" className="mt-3 block cursor-text">
        <span className="text-sm text-muted">{inputLabel}</span>
        <span id="home-race-text" className="mt-1 block break-words whitespace-pre-wrap font-mono text-base leading-relaxed" aria-hidden="true">
          {Array.from(text).map((char, index) => <span key={index} className={
            index < typed.length
              ? typed[index] === char ? "text-accent-text" : "bg-danger/15 text-danger underline"
              : index === typed.length ? "text-foreground underline decoration-accent-text decoration-2 underline-offset-4" : "text-muted"
          }>{char}</span>)}
        </span>
      </label>
      <input id="home-race-input" name="trial" type="text"
        {...inputProps}
        aria-describedby="home-race-sentence home-race-hint" autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false}
        className="mt-2 min-h-11 w-full rounded-field border border-border bg-surface px-3 font-mono text-base text-foreground caret-accent-text focus-visible:outline-2 focus-visible:outline-accent-text"
      />
      <p id="home-race-sentence" className="sr-only">{text}</p>
      <p id="home-race-hint" className="mt-2 text-xs text-muted">{hint}</p>
    </>
  );
}
