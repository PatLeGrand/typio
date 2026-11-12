import { ArrowRight } from "lucide-react";
import type { ButtonVariant } from "./buttonStyles";

export function ButtonDecor({ variant }: { variant: ButtonVariant }) {
  if (variant === "primary") return null;

  if (variant === "start") {
    return (
      <span aria-hidden="true" className="button-start-decor pointer-events-none absolute inset-0">
        <span className="absolute inset-y-0 left-5 flex items-center gap-[5px]">
          {[0, 1, 2].map((index) => <span key={index} className="button-start-light relative size-2.5 rounded-full bg-foreground/15" />)}
        </span>
        <span className="absolute inset-y-0 right-2 flex items-center">
          <span className="button-start-arrow flex h-11 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <ArrowRight size={20} />
          </span>
        </span>
      </span>
    );
  }

  if (variant === "key") {
    return (
      <span aria-hidden="true" className="button-blobs absolute inset-0 overflow-hidden rounded-[inherit]">
        <span className="button-blob-group pointer-events-none absolute inset-0">
          {[0, 1, 2, 3].map((index) => <span key={index} className="button-blob bg-accent" />)}
        </span>
        <span data-side="left" className="absolute inset-y-0 left-0 z-20 w-1/2" />
        <span data-side="right" className="absolute inset-y-0 right-0 z-20 w-1/2" />
      </span>
    );
  }

  return (
    <svg aria-hidden="true" focusable="false" className="button-road pointer-events-none absolute inset-px h-[calc(100%-2px)] w-[calc(100%-2px)] overflow-visible">
      <rect width="100%" height="100%" rx="11" fill="none" />
    </svg>
  );
}
