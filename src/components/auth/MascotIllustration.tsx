import Image from "next/image";
import { Sparkles, Star } from "lucide-react";
import type { CSSProperties } from "react";
import type { Dictionary } from "@/i18n/dictionaries";

type MascotIllustrationProps = {
  labels: Dictionary["illustration"];
};

// La scène est dessinée sur 600 x 420 px (maquette à 1440 px, origine au centre du halo) puis
// mise à l'échelle : toutes les positions et tailles sont des pourcentages de la scène, les
// textes des `cqw` (1 % de sa largeur), pour que l'illustration rétrécisse avec son panneau.
const STAGE_WIDTH = 600;
const STAGE_HEIGHT = 420;

const horizontal = (px: number) => `${(px / STAGE_WIDTH) * 100}%`;
const vertical = (px: number) => `${(px / STAGE_HEIGHT) * 100}%`;
const fontSize = (px: number) => `${(px / STAGE_WIDTH) * 100}cqw`;

/** Élément centré sur (x, y), exprimés depuis le coin haut gauche de la scène. */
function placed(x: number, y: number, width: number, height: number, rotation = 0): CSSProperties {
  return {
    left: horizontal(x),
    top: vertical(y),
    width: horizontal(width),
    height: vertical(height),
    transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
  };
}

const keyClasses =
  "absolute flex items-center justify-center rounded-[14px] border-b-4 border-key-ink/20 font-extrabold text-key-ink shadow-soft";

/**
 * Illustration décorative du panneau de connexion : le poulpe au clavier, son halo, deux
 * touches volantes, la bulle d'encouragement et la touche « espace ». Entièrement `aria-hidden` :
 * rien ici n'est nécessaire à la compréhension de la page.
 */
export function MascotIllustration({ labels }: MascotIllustrationProps) {
  return (
    <div
      aria-hidden="true"
      className="relative w-full max-w-[600px]"
      style={{ aspectRatio: `${STAGE_WIDTH} / ${STAGE_HEIGHT}`, containerType: "inline-size" }}
    >
      <div className="absolute rounded-[50%] bg-accent/15" style={placed(300, 210, 444, 376)} />
      {/* Image décorative : alt vide. Son cadre dépasse la scène, le poulpe en reste le cœur. */}
      <Image
        src="/images/mascotte-poulpe.png"
        alt=""
        width={1264}
        height={848}
        sizes="(min-width: 1440px) 655px, 45vw"
        className="absolute h-auto max-w-none"
        style={{
          left: horizontal(300),
          top: vertical(210),
          width: horizontal(655),
          transform: "translate(-50%, -50%)",
        }}
      />
      <div className={`${keyClasses} bg-key-yellow`} style={{ ...placed(50, 70, 58, 58, -8), fontSize: fontSize(24) }}>
        A
      </div>
      <div className={`${keyClasses} bg-key-mint`} style={{ ...placed(553, 185, 60, 60, 12), fontSize: fontSize(24) }}>
        Z
      </div>
      <div
        className="absolute flex items-center justify-center gap-[3%] rounded-full bg-surface font-bold text-foreground shadow-soft"
        style={{ ...placed(461, 32, 131, 40, 10), fontSize: fontSize(14) }}
      >
        <Star className="size-[1.15em] shrink-0" />
        {labels.praise}
      </div>
      <div
        className={`${keyClasses} rounded-xl bg-key-coral`}
        style={{ ...placed(85, 348, 117, 46, -8), fontSize: fontSize(14) }}
      >
        {labels.spaceKey}
      </div>
      <Sparkles className="absolute text-accent-text" style={placed(565, 331, 32, 32)} />
    </div>
  );
}
