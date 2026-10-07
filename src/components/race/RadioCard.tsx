import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { CheckCircle2, Circle } from "lucide-react";

type RadioCardProps = Omit<ComponentPropsWithoutRef<"button">, "onChange"> & {
  checked: boolean;
  onChange: () => void;
  label: ReactNode;
  description?: ReactNode;
  layout?: "horizontal" | "vertical";
};

export function RadioCard({
  checked,
  onChange,
  label,
  description,
  layout = "horizontal",
  className = "",
  ...props
}: RadioCardProps) {
  const isVertical = layout === "vertical";

  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      tabIndex={checked ? 0 : -1}
      onKeyDown={(event) => {
        if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
        const group = event.currentTarget.closest('[role="radiogroup"]');
        if (!group) return;
        const options = Array.from(group.querySelectorAll<HTMLButtonElement>('[role="radio"]:not(:disabled)'));
        const index = options.indexOf(event.currentTarget);
        const direction = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
        const next = options[(index + direction + options.length) % options.length];
        event.preventDefault();
        next?.focus();
        next?.click();
      }}
      onClick={onChange}
      className={`
        relative flex text-left transition-colors
        ${isVertical ? "flex-col items-start p-4 gap-2" : "items-center justify-center p-3 gap-2 min-h-11"}
        ${checked
          ? "border-2 border-accent-text bg-accent-soft text-accent-text"
          : "border border-border bg-surface text-foreground hover:bg-accent-soft/50"}
        rounded-field w-full
        ${className}
      `}
      {...props}
    >
      {checked ? (
        <CheckCircle2 className={`shrink-0 ${isVertical ? "absolute right-4 top-4" : ""} w-5 h-5`} />
      ) : isVertical ? (
        <Circle className="shrink-0 absolute right-4 top-4 w-5 h-5 text-border" />
      ) : null}

      <div className={`flex flex-col ${isVertical ? "pr-8" : ""}`}>
        <span className={`font-semibold ${isVertical ? "text-base text-foreground" : "text-sm"}`}>
          {label}
        </span>
        {description && (
          <span className="text-sm text-muted font-normal mt-1">
            {description}
          </span>
        )}
      </div>
    </button>
  );
}
