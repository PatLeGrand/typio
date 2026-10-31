"use client";

import { useState } from "react";
import { avatarColorIndex, avatarColorVar, avatarInitial, avatarUrl, type AvatarIdentity } from "./avatar";

type AvatarProps = AvatarIdentity & {
  name: string;
  /** Côté en px. */
  size: number;
  /** Vrai (défaut) si le nom est déjà affiché à côté : l'avatar est alors décoratif. */
  nameShown?: boolean;
};

/**
 * Photo de profil si la personne en a une, sinon avatar généré (H-39) : initiale sur une couleur
 * tirée de la graine. Une photo qui ne charge pas retombe sur l'avatar généré.
 */
export function Avatar({ name, seed, userId, avatarVersion, size, nameShown = true }: AvatarProps) {
  const src = avatarUrl(userId, avatarVersion);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showPhoto = src !== null && failedSrc !== src;
  const box = { width: size, height: size };

  if (showPhoto) {
    return (
      // Photo servie par notre route authentifiée, déjà carrée et réduite : `next/image` n'apporte rien.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={nameShown ? "" : name}
        width={size}
        height={size}
        style={box}
        onError={() => setFailedSrc(src)}
        className="shrink-0 rounded-full border border-border bg-surface object-cover"
      />
    );
  }
  return (
    <span
      role={nameShown ? undefined : "img"}
      aria-label={nameShown ? undefined : name}
      aria-hidden={nameShown ? true : undefined}
      style={{
        ...box,
        fontSize: Math.round(size * 0.45),
        backgroundColor: `var(${avatarColorVar(avatarColorIndex(seed))})`,
        color: "var(--avatar-foreground)",
      }}
      className="inline-flex shrink-0 select-none items-center justify-center rounded-full border border-border font-bold leading-none"
    >
      {avatarInitial(name)}
    </span>
  );
}
