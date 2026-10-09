import { Card } from "@/components/Card";
import { SelectField } from "@/components/SelectField";
import type { RoomConfig, RoomConfigPatch } from "@/realtime/protocol";
import { configFields, configPatch, type RoomConfigLabels } from "./roomConfigFields";

type RoomConfigPanelProps = {
  config: RoomConfig;
  /** Vrai pour l'hôte : listes modifiables. Sinon, lecture seule (SALLE-10). */
  editable: boolean;
  labels: RoomConfigLabels;
  onChange: (patch: RoomConfigPatch) => void;
};

/** Configuration de la salle : listes étiquetées pour l'hôte, liste de valeurs pour les autres. */
export function RoomConfigPanel({ config, editable, labels, onChange }: RoomConfigPanelProps) {
  const fields = configFields(config, labels);

  return (
    <Card className="flex flex-col gap-4 border border-border p-6">
      <h2 className="text-lg font-bold text-foreground">{labels.title}</h2>
      {editable ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {fields.map((field) => (
            <SelectField
              key={field.key}
              label={field.label}
              options={field.options}
              value={field.value}
              onChange={(event) => {
                const patch = configPatch(field.key, event.target.value);
                if (patch) onChange(patch);
              }}
            />
          ))}
        </div>
      ) : (
        <>
          <dl className="grid gap-4 sm:grid-cols-2">
            {fields.map((field) => (
              <div key={field.key} className="flex flex-col gap-1">
                <dt className="text-sm font-semibold text-muted-strong">{field.label}</dt>
                <dd className="text-[15px] text-foreground">{field.valueLabel}</dd>
              </div>
            ))}
          </dl>
          <p className="text-sm text-muted-strong">{labels.hostOnly}</p>
        </>
      )}
    </Card>
  );
}
