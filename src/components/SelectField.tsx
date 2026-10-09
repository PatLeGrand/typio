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
  /** Message d'erreur déjà traduit ; marque la liste comme invalide. */
  error?: string;
};

/** Libellé + liste déroulante native, dans le même style que `TextField`. */
export function SelectField({
  label,
  options,
  error,
  id,
  "aria-describedby": describedBy,
  ...props
}: SelectFieldProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const errorId = `${selectId}-error`;
  const describedByIds = [describedBy, error ? errorId : undefined].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex flex-col gap-[9px]">
      <label htmlFor={selectId} className="text-sm font-semibold text-foreground">
        {label}
      </label>
      <select
        id={selectId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedByIds}
        className={`h-14 w-full rounded-field border bg-surface px-4 text-[15px] text-foreground disabled:cursor-not-allowed disabled:text-muted ${
          error ? "border-danger" : "border-border"
        }`}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? (
        <p id={errorId} className="text-[13px] font-semibold text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
