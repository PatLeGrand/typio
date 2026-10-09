import type { Locale } from "@/i18n/config";

export interface MemberRecord {
  id: string;
  passwordHash: string;
}

/** L'identifiant (sans casse) est déjà pris : violation de l'index unique. */
export class UsernameTakenError extends Error {
  constructor() {
    super("USERNAME_TAKEN");
    this.name = "UsernameTakenError";
  }
}

/** Accès aux comptes, injecté : les parcours d'authentification se testent sans base. */
export interface UserRepository {
  /** `username` est déjà en minuscules. Ne renvoie que des membres. */
  findMemberByUsername(username: string): Promise<MemberRecord | null>;
  /**
   * Vrai si un MEMBRE a ce `usernameSkeleton`. Sert à refuser un pseudo d'invité ou un nom
   * affiché qui usurperait un membre : l'appelant passe `pseudoSkeleton(pseudo)`, pas la forme
   * affichée. `exceptUserId` exclut la ligne de ce membre (il ne s'usurpe pas lui-même).
   */
  memberUsernameExists(skeleton: string, options?: { exceptUserId?: string }): Promise<boolean>;
  /** Lève `UsernameTakenError` si l'identifiant existe déjà. */
  createMember(params: {
    username: string;
    displayName: string;
    passwordHash: string;
    locale: Locale;
  }): Promise<{ id: string }>;
  createGuest(params: {
    displayName: string;
    locale: Locale;
    expiresAt: Date;
  }): Promise<{ id: string }>;
  /**
   * Supprime au plus `limit` invités échus (leurs sessions suivent, en cascade) ; renvoie
   * le nombre de lignes supprimées. H-2 : un invité n'a pas d'identité durable.
   */
  deleteExpiredGuests(now: Date, limit: number): Promise<number>;
  /**
   * Supprime l'invité `id` (ses sessions suivent, en cascade). Ne touche jamais un membre :
   * sans effet si `id` n'est pas un invité.
   */
  deleteGuest(id: string): Promise<void>;
}
