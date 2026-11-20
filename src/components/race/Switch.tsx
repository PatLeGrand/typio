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
        relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-text focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60
        ${checked ? "border-accent bg-accent dark:border-accent-text" : "border-muted bg-surface"}
        ${className}
      `}
      {...props}
    >
      <span
        className={`
          pointer-events-none inline-block size-5 rounded-full shadow-sm ring-0 transition-transform motion-reduce:transition-none
          ${checked ? "translate-x-[22px] bg-accent-foreground" : "translate-x-0.5 bg-muted"}
        `}
      />
    </button>
  );
}
