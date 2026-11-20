import { SelectField } from "@/components/SelectField";
import type { Dictionary } from "@/i18n/dictionaries";
import type { RaceSettings } from "@/race/config";
import { MAX_CAPACITY, MIN_CAPACITY, ROOM_VISIBILITIES } from "@/realtime/protocol";
import type { RoomVisibility } from "@/realtime/protocol";

type RaceRoomSettingsProps = {
  value: RaceSettings;
  onChange: (patch: Partial<RaceSettings>) => void;
  readOnly: boolean;
  dict: Dictionary["raceSettings"];
  lang: string;
  /** Préfixe d'identifiants issu du `useId` de `RaceSettingsFields`. */
  idPrefix: string;
  headingLevel: 2 | 3;
  /** Mise en page compacte sur une colonne (dans le bloc « Avec des amis » du panneau de droite). */
  compact?: boolean;
};

/** Section « salle » des réglages de course (SALLE-03, SALLE-05). */
export function RaceRoomSettings({ value, onChange, readOnly, dict, lang, idPrefix, headingLevel, compact = false }: RaceRoomSettingsProps) {
  const SectionHeading = headingLevel === 3 ? "h3" : "h2";
  const id = (name: string) => `${idPrefix}-${name}`;
  const numberFormat = new Intl.NumberFormat(lang);
  const capacityOptions = Array.from({ length: MAX_CAPACITY - MIN_CAPACITY + 1 }, (_, index) => {
    const capacity = MIN_CAPACITY + index;
    return { value: String(capacity), label: numberFormat.format(capacity) };
  });

  return (
    <section className={compact ? "flex flex-col gap-3" : "flex flex-col gap-4 border-t border-border/80 pt-6"}>
      <div>
        <SectionHeading
          className={
            compact
              ? "text-sm font-bold text-foreground"
              : headingLevel === 3
                ? "text-base font-bold text-foreground"
                : "font-display text-[1.65rem] font-black leading-none tracking-[-0.01em] text-foreground"
          }
        >
          {dict.roomSection.title}
        </SectionHeading>
        {compact ? null : <p className="mt-1 text-sm text-muted">{dict.roomSection.subtitle}</p>}
      </div>

      <div className={compact ? "flex flex-col gap-3.5" : "grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2"}>
        <div className="flex flex-col gap-1.5">
          <SelectField
            label={dict.visibility.label}
            value={value.visibility}
            disabled={readOnly}
            options={ROOM_VISIBILITIES.map((visibility) => ({ value: visibility, label: dict.visibility[visibility] }))}
            onChange={(event) => onChange({ visibility: event.target.value as RoomVisibility })}
            aria-describedby={id("visibility-help")}
          />
          <p id={id("visibility-help")} className="text-xs leading-relaxed text-muted">{dict.visibility.help}</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <SelectField
            label={dict.capacity.label}
            value={String(value.capacity)}
            disabled={readOnly}
            options={capacityOptions}
            onChange={(event) => onChange({ capacity: Number(event.target.value) })}
            aria-describedby={id("capacity-help")}
          />
          <p id={id("capacity-help")} className="text-xs leading-relaxed text-muted">{dict.capacity.help}</p>
        </div>
      </div>
    </section>
  );
}
