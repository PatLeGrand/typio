/** Logique pure des avatars (AUTH-03, COURSE-05, H-39) : couleur, initiale et URL de la photo. */

/** Nombre de couleurs de la palette `--avatar-1` à `--avatar-8` de `globals.css`. */
export const AVATAR_COLOR_COUNT = 8;

/** Ce qu'il faut pour dessiner l'avatar de quelqu'un : photo si `userId` et `avatarVersion` sont connus. */
export interface AvatarIdentity {
  /** Identifiant (utilisateur) ou nom (bot) dont la couleur générée est tirée. */
  seed: string;
  /** Nom dont on tire l'initiale, si différent du nom affiché (le joueur solo s'affiche « Toi »). */
  name?: string;
  userId?: string;
  avatarVersion?: number | null;
}

/** Identité d'avatar d'un coureur de salle : un bot se reconnaît à son nom, un humain à son identifiant. */
export function runnerAvatar(runner: { id: string; name: string; kind: "human" | "bot"; avatarVersion: number | null }): AvatarIdentity {
  return runner.kind === "bot"
    ? { seed: runner.name }
    : { seed: runner.id, userId: runner.id, avatarVersion: runner.avatarVersion };
}

/** Indice stable (FNV-1a) dans la palette : la même graine donne toujours la même couleur. */
export function avatarColorIndex(seed: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash % AVATAR_COLOR_COUNT;
}

/** Premier graphème du nom, en majuscule ; `?` si le nom est vide. */
export function avatarInitial(name: string): string {
  const trimmed = name.trim();
  if (trimmed === "") return "?";
  const [first] = new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(trimmed);
  return first.segment.toLocaleUpperCase();
}

/** URL versionnée de la photo (H-38), ou `null` si la personne n'en a pas. */
export function avatarUrl(userId: string | undefined, avatarVersion: number | null | undefined): string | null {
  if (!userId || avatarVersion === null || avatarVersion === undefined) return null;
  return `/api/avatars/${userId}?v=${avatarVersion}`;
}

/** Nom de la variable CSS de la couleur d'indice `index`. */
export function avatarColorVar(index: number): string {
  return `--avatar-${index + 1}`;
}
