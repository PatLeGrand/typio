import { useId, type ComponentPropsWithoutRef } from "react";

export interface SelectOption {
  value: string;
  /** Libellé visible, texte déjà traduit. */
  label: string;
}

export type SelectFieldProps = Omit<ComponentPropsWithoutRef<"select">, "className" | "children"> & {
  /** Libellé visible, texte déjà traduit. */
  label: string;
  options: readonly SelectOption[];
};

/** Libellé + liste déroulante native, dans le même style que `TextField`. */
export function SelectField({ label, options, id, ...props }: SelectFieldProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;

  return (
    <div className="flex flex-col gap-[9px]">
      <label htmlFor={selectId} className="text-sm font-semibold text-foreground">
        {label}
      </label>
      <select
        id={selectId}
        className="h-12 w-full rounded-field border border-border bg-surface px-3 text-[15px] text-foreground disabled:cursor-not-allowed disabled:text-muted"
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
