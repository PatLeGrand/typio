/**
 * Contrat temps réel entre le navigateur et le service `realtime` (ADR-001), périmètre
 * du checkpoint 1 : créer une salle, la rejoindre par code, voir participants et
 * configuration changer sans recharger (SALLE-1, SALLE-4, SALLE-7, SALLE-10, SALLE-12).
 *
 * Ce fichier est importé des deux côtés : aucune dépendance serveur ni navigateur ici.
 * Le serveur ne fait confiance à rien de ce qu'envoie le client : chaque charge utile
 * passe par un `parse*` ci-dessous avant usage.
 */

import { isRoomCode, normalizeRoomCode } from "./roomCode";

// ── Constantes métier ───────────────────────────────────────────────────────

/** Plafond de coureurs par salle (H-16). Les spectateurs ne comptent pas. */
export const MAX_RUNNERS = 20;

/** Délai de grâce d'un participant déconnecté avant son retrait (H-9, SALLE-13). */
export const RECONNECT_GRACE_MS = 60_000;

// ── Configuration de la salle (CONFIG-1 à CONFIG-8) ─────────────────────────

export const TEXT_MODES = ["sentences", "words"] as const;
export type TextMode = (typeof TEXT_MODES)[number];

export const TEXT_LANGUAGES = ["fr", "en"] as const;
export type TextLanguage = (typeof TEXT_LANGUAGES)[number];

export const TEXT_LENGTHS = ["short", "medium", "long"] as const;
export type TextLength = (typeof TEXT_LENGTHS)[number];

/** Limites de temps proposées à l'hôte, en secondes ; `null` = défaut de 5 min (CONFIG-6, H-9). */
export const TIME_LIMITS_SECONDS = [60, 120, 180, 300, 600] as const;
export type TimeLimitSeconds = (typeof TIME_LIMITS_SECONDS)[number];

export const INPUT_MODES = ["free", "blocking"] as const;
export type InputMode = (typeof INPUT_MODES)[number];

export const BOT_DIFFICULTIES = ["easy", "normal", "hard"] as const;
export type BotDifficulty = (typeof BOT_DIFFICULTIES)[number];

export const MAX_BOTS = 7;
export const MAX_EXCLUDED_INPUT_LENGTH = 100;
export const MAX_EXCLUDED_CHARACTERS = 30;

export interface RoomConfig {
  textMode: TextMode;
  language: TextLanguage;
  length: TextLength;
  timeLimitSeconds: TimeLimitSeconds | null;
  accents: boolean;
  excludedCharacters: string;
  inputMode: InputMode;
  botCount: number;
  botDifficulty: BotDifficulty;
}

export type RoomConfigPatch = Partial<RoomConfig>;

export const DEFAULT_ROOM_CONFIG: RoomConfig = {
  textMode: "sentences",
  language: "fr",
  length: "medium",
  timeLimitSeconds: null,
  accents: true,
  excludedCharacters: "",
  inputMode: "free",
  botCount: 0,
  botDifficulty: "normal",
};

// ── État de la salle, diffusé en entier à chaque changement (ADR-001) ──────

/** Seul `waiting` est atteint au checkpoint 1 ; les autres viennent avec la course. */
export type RoomStatus = "waiting" | "countdown" | "racing" | "results" | "closed";

export type ParticipantRole = "runner" | "spectator";

export interface Participant {
  /** `users.id` : un utilisateur n'apparaît qu'une fois, même avec plusieurs onglets. */
  userId: string;
  displayName: string;
  kind: "member" | "guest";
  role: ParticipantRole;
  /** Faux pendant le délai de grâce qui suit une déconnexion (SALLE-13). */
  connected: boolean;
  /** Horodatage serveur (ms) de l'arrivée : départage « le plus ancien » (SALLE-15). */
  joinedAt: number;
}

export interface RoomState {
  code: string;
  status: RoomStatus;
  hostId: string;
  config: RoomConfig;
  /** Dans l'ordre d'arrivée. */
  participants: Participant[];
  maxRunners: number;
}

// ── Erreurs : des codes, jamais des phrases (UI-5, traduites côté client) ──

export const ROOM_ERROR_CODES = [
  "UNAUTHENTICATED",
  "INVALID_PAYLOAD",
  "INVALID_CODE",
  "GUEST_CANNOT_CREATE",
  "ROOM_NOT_FOUND",
  "ROOM_FULL",
  "ALREADY_IN_ROOM",
  "NOT_IN_ROOM",
  "NOT_HOST",
  "CONFIG_LOCKED",
  "INTERNAL",
] as const;

export type RoomErrorCode = (typeof ROOM_ERROR_CODES)[number];

/** Réponse d'accusé de réception : chaque commande client reçoit l'une des deux formes. */
export type Ack<T = undefined> = T extends undefined
  ? { ok: true } | { ok: false; error: RoomErrorCode }
  : { ok: true; data: T } | { ok: false; error: RoomErrorCode };

// ── Événements Socket.IO, typés des deux côtés ──────────────────────────────

export interface JoinPayload {
  code: string;
  role: ParticipantRole;
}

/** Client → serveur. Toujours avec un accusé ; un refus ne change pas l'état. */
export interface ClientToServerEvents {
  /** Membre seulement (SALLE-1, SALLE-12). Le créateur devient hôte et coureur. */
  "room:create": (config: unknown, ack: (res: Ack<{ code: string }>) => void) => void;
  /** Rejoindre par code (SALLE-4, SALLE-7). Coureur refusé au-delà de MAX_RUNNERS. */
  "room:join": (payload: unknown, ack: (res: Ack<{ code: string }>) => void) => void;
  /** Hôte seulement, en `waiting` seulement (SALLE-10). */
  "room:updateConfig": (patch: unknown, ack: (res: Ack) => void) => void;
  "room:leave": (ack: (res: Ack) => void) => void;
}

/** Serveur → client. */
export interface ServerToClientEvents {
  /** État complet, envoyé à toute la salle après chaque changement. */
  "room:state": (state: RoomState) => void;
  /** Erreur non sollicitée (salle fermée, retrait…), hors accusé de réception. */
  "room:error": (error: RoomErrorCode) => void;
}

/** Données attachées au socket par le middleware d'authentification du serveur. */
export interface SocketData {
  user: { id: string; kind: "member" | "guest"; displayName: string };
  /** Code de la salle où se trouve l'utilisateur, s'il y en a une. */
  roomCode: string | null;
}

// ── Validation des charges utiles reçues du client ──────────────────────────

function isOneOf<T extends readonly unknown[]>(values: T, value: unknown): value is T[number] {
  return values.includes(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const CONFIG_KEYS: ReadonlyArray<keyof RoomConfig> = [
  "textMode",
  "language",
  "length",
  "timeLimitSeconds",
  "accents",
  "excludedCharacters",
  "inputMode",
  "botCount",
  "botDifficulty",
];

/**
 * Caractères qu'il est utile d'exclure : ceux que le générateur de textes peut produire.
 * Lettres latines (avec les accents du français), chiffres, ponctuation ASCII et française.
 */
const EXCLUDABLE_CHARACTER = /^[A-Za-z0-9À-ÖØ-öø-ÿŒœ!-/:-@[-`{-~«»’…–—]$/u;

/**
 * Caractères exclus (CONFIG-5, B-D1) : en minuscules (le générateur ignore la casse), uniques,
 * pris dans la liste ci-dessus, 30 au plus, puis **triés**. L'hôte ne choisit ni les glyphes, ni
 * la casse, ni l'ordre : la salle diffuse un jeu de caractères, jamais un mot lisible. Les
 * surrogates isolés ne sont pas dans la liste. `null` si l'entrée brute est trop longue.
 */
export function normalizeExcludedCharacters(input: string): string | null {
  if (input.length > MAX_EXCLUDED_INPUT_LENGTH) return null;

  const kept = new Set<string>();
  for (const character of Array.from(input.normalize("NFC").toLowerCase())) {
    if (!EXCLUDABLE_CHARACTER.test(character)) continue;
    kept.add(character);
    if (kept.size === MAX_EXCLUDED_CHARACTERS) break;
  }
  return [...kept].sort().join("");
}

/**
 * Patch de configuration valide, ou `null`. Refuse toute clé inconnue et toute valeur
 * hors liste : un client modifié ne peut rien glisser d'autre dans l'état diffusé.
 * `undefined` ou `{}` donnent un patch vide (création avec la config par défaut).
 */
export function parseRoomConfigPatch(input: unknown): RoomConfigPatch | null {
  if (input === undefined) return {};
  if (!isPlainObject(input)) return null;

  const patch: RoomConfigPatch = {};
  for (const [key, value] of Object.entries(input)) {
    if (!(CONFIG_KEYS as readonly string[]).includes(key)) return null;
    switch (key as keyof RoomConfig) {
      case "textMode":
        if (!isOneOf(TEXT_MODES, value)) return null;
        patch.textMode = value;
        break;
      case "language":
        if (!isOneOf(TEXT_LANGUAGES, value)) return null;
        patch.language = value;
        break;
      case "length":
        if (!isOneOf(TEXT_LENGTHS, value)) return null;
        patch.length = value;
        break;
      case "timeLimitSeconds":
        if (value !== null && !isOneOf(TIME_LIMITS_SECONDS, value)) return null;
        patch.timeLimitSeconds = value;
        break;
      case "accents":
        if (typeof value !== "boolean") return null;
        patch.accents = value;
        break;
      case "excludedCharacters": {
        if (typeof value !== "string") return null;
        const normalized = normalizeExcludedCharacters(value);
        if (normalized === null) return null;
        patch.excludedCharacters = normalized;
        break;
      }
      case "inputMode":
        if (!isOneOf(INPUT_MODES, value)) return null;
        patch.inputMode = value;
        break;
      case "botCount":
        if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > MAX_BOTS) {
          return null;
        }
        patch.botCount = value + 0; // -0 devient 0
        break;
      case "botDifficulty":
        if (!isOneOf(BOT_DIFFICULTIES, value)) return null;
        patch.botDifficulty = value;
        break;
    }
  }
  return patch;
}

/**
 * Charge utile de `room:join` avec le code normalisé (majuscules, sans espaces), ou le
 * code d'erreur à renvoyer : `INVALID_CODE` si seul le code de salle est mal formé.
 */
export function parseJoinPayload(input: unknown): JoinPayload | "INVALID_PAYLOAD" | "INVALID_CODE" {
  if (!isPlainObject(input)) return "INVALID_PAYLOAD";
  const { code, role } = input;
  if (typeof code !== "string" || !isOneOf(["runner", "spectator"] as const, role)) {
    return "INVALID_PAYLOAD";
  }
  const normalized = normalizeRoomCode(code);
  if (!isRoomCode(normalized)) return "INVALID_CODE";
  return { code: normalized, role };
}
