import { DoorOpen } from "lucide-react";
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
};

/** Section « salle » des réglages de course (SALLE-03, SALLE-05). */
export function RaceRoomSettings({ value, onChange, readOnly, dict, lang, idPrefix, headingLevel }: RaceRoomSettingsProps) {
  const SectionHeading = headingLevel === 3 ? "h3" : "h2";
  const id = (name: string) => `${idPrefix}-${name}`;
  const numberFormat = new Intl.NumberFormat(lang);
  const capacityOptions = Array.from({ length: MAX_CAPACITY - MIN_CAPACITY + 1 }, (_, index) => {
    const capacity = MIN_CAPACITY + index;
    return { value: String(capacity), label: numberFormat.format(capacity) };
  });

  return (
    <section className="bg-surface border border-border rounded-[24px] p-4 sm:p-8">
      <div className="flex flex-wrap items-center gap-4 mb-8">
        <div className="w-12 h-12 rounded-2xl bg-accent-soft text-accent-text flex items-center justify-center">
          <DoorOpen className="w-6 h-6" aria-hidden="true" />
        </div>
        <div>
          <SectionHeading className="text-xl font-bold text-foreground">{dict.roomSection.title}</SectionHeading>
          <p className="text-sm text-muted">{dict.roomSection.subtitle}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
        <div className="flex flex-col gap-2">
          <SelectField
            label={dict.visibility.label}
            value={value.visibility}
            disabled={readOnly}
            options={ROOM_VISIBILITIES.map((visibility) => ({ value: visibility, label: dict.visibility[visibility] }))}
            onChange={(event) => onChange({ visibility: event.target.value as RoomVisibility })}
            aria-describedby={id("visibility-help")}
          />
          <p id={id("visibility-help")} className="text-xs text-muted">{dict.visibility.help}</p>
        </div>
        <div className="flex flex-col gap-2">
          <SelectField
            label={dict.capacity.label}
            value={String(value.capacity)}
            disabled={readOnly}
            options={capacityOptions}
            onChange={(event) => onChange({ capacity: Number(event.target.value) })}
            aria-describedby={id("capacity-help")}
          />
          <p id={id("capacity-help")} className="text-xs text-muted">{dict.capacity.help}</p>
        </div>
      </div>
    </section>
  );
}
