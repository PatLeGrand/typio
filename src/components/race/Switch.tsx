import type { ComponentPropsWithoutRef } from "react";

type SwitchProps = Omit<ComponentPropsWithoutRef<"button">, "onChange"> & {
  checked: boolean;
  onChange: (checked: boolean) => void;
};

export function Switch({ checked, onChange, className = "", ...props }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`
        relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-text focus-visible:ring-offset-2
        ${checked ? "bg-accent" : "bg-border"}
        ${className}
      `}
      {...props}
    >
      <span
        className={`
          pointer-events-none inline-block h-6 w-6 rounded-full bg-accent-foreground shadow-lg ring-0 transition-transform
          ${checked ? "translate-x-5" : "translate-x-0"}
        `}
      />
    </button>
  );
}
