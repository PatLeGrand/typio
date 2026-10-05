import type { ComponentPropsWithoutRef } from "react";

type GithubIconProps = Omit<ComponentPropsWithoutRef<"svg">, "children" | "viewBox" | "fill" | "stroke">;

/**
 * Logo GitHub au trait de la maquette (docs/design/login/assets/github.svg), recolorable par
 * `currentColor` (Lucide 1.x ne fournit plus les logos de marques). Décoratif par défaut.
 */
export function GithubIcon({ "aria-hidden": ariaHidden = true, ...props }: GithubIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={20}
      height={20}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      aria-hidden={ariaHidden}
      {...props}
    >
      <path d="M7.49949 18.334V15.0004C7.44115 14.4837 7.48282 13.9586 7.62449 13.4586C7.76617 12.9586 8.00785 12.4919 8.33287 12.0835C5.83273 12.0835 3.33259 10.4167 3.33259 7.4998C3.26464 6.46037 3.55916 5.42954 4.16597 4.5829C3.91595 3.62449 3.91595 2.62441 4.16597 1.666C4.16597 1.666 4.99935 1.666 6.66611 2.9161C8.86623 2.4994 11.133 2.4994 13.3331 2.9161C14.9999 1.666 15.8333 1.666 15.8333 1.666C16.0666 2.62441 16.0666 3.62449 15.8333 4.5829C16.4417 5.43297 16.7333 6.45805 16.6667 7.4998C16.6667 10.4167 14.1665 12.0835 11.6664 12.0835C12.3164 12.9087 12.6157 13.9564 12.4998 15.0004V18.334M7.49949 15.0004C3.74094 16.6672 3.33276 13.3336 1.666 13.3336" />
    </svg>
  );
}
