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
}
