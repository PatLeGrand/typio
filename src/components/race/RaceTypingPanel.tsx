"use client";

import { useEffect, useRef, useState, type ChangeEvent, type RefObject, type SyntheticEvent } from "react";
import { CornerDownLeft, Delete, Keyboard, Sparkles } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries";
import { countCorrectChars } from "@/race/metrics";
import type { InputMode } from "@/realtime/protocol";

type Props = {
  locale?: string;
  embedded?: boolean;
  focusRef?: RefObject<HTMLInputElement | null>;
  labels: Dictionary["raceScreen"]["typing"];
  text: string;
  typed: string;
  inputMode: InputMode;
  wordCapKey?: string;
  fog?: boolean;
  bonusMessage?: string;
  onChange: (value: string) => void;
};

const TEXT_ID = "race-text";

/** Texte à taper (caractères colorés selon la frappe) et champ de saisie, sans copier-coller (COURSE-04). */
export function RaceTypingPanel({ focusRef, locale, embedded = false, labels, text, typed, inputMode, wordCapKey, fog = false, bonusMessage = "", onChange }: Props) {
  const localInputRef = useRef<HTMLInputElement>(null);
  const inputRef = focusRef ?? localInputRef;
  // Pendant une composition (touche morte « ^ » puis « e », IME), la valeur brute est affichée
  // sans être jugée : « ^ » n'est pas une frappe, seul « ê » final compte.
  const composing = useRef(false);
  const [draft, setDraft] = useState<string | null>(null);

  // Le champ est actif dès l'écran de course, pour que les premières frappes ne soient pas perdues :
  // la saisie est ignorée tant que le départ n'est pas donné.
  useEffect(() => {
    inputRef.current?.focus();
  }, [inputRef]);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    if (composing.current || (event.nativeEvent as InputEvent).isComposing) {
      setDraft(event.target.value);
      return;
    }
    onChange(event.target.value);
  }

  function handleCompositionEnd(event: SyntheticEvent<HTMLInputElement>) {
    composing.current = false;
    setDraft(null);
    onChange(event.currentTarget.value);
  }

  // Le curseur reste en fin de champ : une frappe au milieu ou le remplacement d'une sélection
  // fausserait le décompte des frappes.
  function keepCaretAtEnd(event: SyntheticEvent<HTMLInputElement>) {
    const field = event.currentTarget;
    if (composing.current) return;
    const end = field.value.length;
    if (field.selectionStart !== end || field.selectionEnd !== end) field.setSelectionRange(end, end);
  }

  const wordEnd = text.indexOf(" ", typed.length);
  const fogStart = wordEnd < 0 ? text.length : wordEnd + 1;
  const number = new Intl.NumberFormat(locale);
  const progressChars = inputMode === "free" ? typed.length : countCorrectChars(typed, text);
  const done = text.length === 0 ? 0 : (progressChars / text.length) * 100;

  return (
    <section className={embedded ? "flex min-w-0 flex-col gap-4" : "mx-auto flex w-full max-w-[1280px] flex-col gap-4 px-4 py-8 sm:px-8"}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="race-desk-title">
          <Keyboard aria-hidden="true" className="size-5 text-accent-text" />
          <h2>{labels.title}</h2>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs font-bold tabular-nums text-muted">
          <span>{number.format(progressChars)} / {number.format(text.length)} {labels.characters}</span>
          <span className="h-2 w-28 overflow-hidden rounded-full bg-accent-soft" aria-hidden="true">
            <span className="block h-full rounded-full bg-accent" style={{ width: `${done}%` }} />
          </span>
        </div>
      </div>

      <p role="status" aria-live="polite" aria-atomic="true" className="text-sm font-bold text-accent-text empty:absolute">{bonusMessage}</p>

      <p id={TEXT_ID} className={embedded ? "race-passage" : "break-words rounded-card border border-border bg-surface px-4 py-5 font-mono text-lg leading-relaxed sm:px-6 sm:text-2xl"}>
        {Array.from(text).map((char, index) => {
          const entered = typed[index];
          const tone =
            entered === undefined
              ? index === typed.length
                ? "rounded-sm bg-accent-panel text-foreground underline decoration-accent-text decoration-2 underline-offset-4"
                : "text-muted"
              : entered === char
                ? "text-series-correct"
                : "bg-danger/15 text-danger underline decoration-danger";
          return <span key={index} className={`${tone}${fog && index >= fogStart ? " blur-sm" : ""}`}>{char}</span>;
        })}
      </p>

      {inputMode === "free" && (
        <div role="status" aria-atomic="true" className="pointer-events-none self-start">
          <p className={`flex items-center gap-2 rounded-field bg-key-mint px-3 py-1.5 text-sm font-bold text-key-ink ${wordCapKey ? "word-cap-notice" : "invisible"}`}>
            {labels.wordCapHint}{" "}
            <kbd className="min-h-7 min-w-7 rounded-md border border-b-[3px] border-key-ink bg-key-yellow px-1.5 text-center font-mono text-base">
              {wordCapKey}
            </kbd>
          </p>
        </div>
      )}

      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={draft ?? typed}
          onChange={handleChange}
          onCompositionStart={() => {
            composing.current = true;
          }}
          onCompositionEnd={handleCompositionEnd}
          onBlur={() => {
            // Sans `compositionend` (focus perdu en pleine composition), les frappes suivantes ne compteraient plus.
            composing.current = false;
            setDraft(null);
          }}
          onSelect={keepCaretAtEnd}
          onKeyUp={keepCaretAtEnd}
          onMouseUp={keepCaretAtEnd}
          onPaste={(event) => event.preventDefault()}
          onDrop={(event) => event.preventDefault()}
          aria-label={labels.inputLabel}
          aria-describedby={TEXT_ID}
          name="race-input"
          placeholder={labels.inputLabel}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          className="min-h-14 w-full rounded-field border border-muted bg-background px-5 pr-12 font-mono text-lg placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text"
        />
        <CornerDownLeft aria-hidden="true" className="pointer-events-none absolute right-4 top-1/2 size-5 -translate-y-1/2 text-accent-text" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
        <p className="flex items-center gap-2">
          <Sparkles aria-hidden="true" className="size-4 text-accent-text" />
          {inputMode === "free" ? labels.freeHint : labels.hint}
        </p>
        <p className="flex items-center gap-2">
          <kbd className="inline-flex items-center rounded-md border border-border px-1.5 py-0.5"><Delete aria-hidden="true" className="size-3.5" /></kbd>
          {labels.fix}
          <span aria-hidden="true">·</span>
          {labels.autoValidate}
        </p>
      </div>
    </section>
  );
}
