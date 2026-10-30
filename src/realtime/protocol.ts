/**
 * Contrat temps réel entre le navigateur et le service `realtime` (ADR-001), périmètre
 * du checkpoint 1 : créer une salle, la rejoindre par code, voir participants et
 * configuration changer sans recharger (SALLE-01, SALLE-02, JOIN-01, SALLE-05, COURSE-05, CONF-12, AUTH-03).
 *
 * Ce fichier est importé des deux côtés : aucune dépendance serveur ni navigateur ici.
 * Le serveur ne fait confiance à rien de ce qu'envoie le client : chaque charge utile
 * passe par un `parse*` ci-dessous avant usage.
 */

import { z } from "zod";
import type { raceSnapshot, raceResults } from "./raceEngine";
import type { Keystrokes } from "@/race/metrics";
import { isRoomCode, normalizeRoomCode } from "./roomCode";

// ── Constantes métier ───────────────────────────────────────────────────────

/** Capacité d'une salle (SALLE-05, H-16) : coureurs humains et bots ; les spectateurs ne comptent pas. */
export const MIN_CAPACITY = 2;
export const MAX_CAPACITY = 30;
export const DEFAULT_CAPACITY = 20;

/** Visibilité d'une salle (SALLE-03) : listée et rejoignable, sur code seulement, ou sur invitation. */
export const ROOM_VISIBILITIES = ["public", "code", "private"] as const;
export type RoomVisibility = (typeof ROOM_VISIBILITIES)[number];

/** Liens d'invitation par salle, révoqués compris (SALLE-04) : borne la mémoire du service. */
export const MAX_INVITES_PER_ROOM = 50;

/** Salles publiques envoyées à l'explorateur au plus (JOIN-02). */
export const LOBBY_MAX_ROOMS = 100;

/** Délai de grâce d'un participant déconnecté avant son retrait (H-9, ancien SALLE-13). */
export const RECONNECT_GRACE_MS = 30_000;

// ── Configuration de la salle (CONF-01 à CONF-04, CONF-06 à CONF-08, CONF-10, BOT-01) ─────────────────────────

export const TEXT_MODES = ["sentences", "words"] as const;
export type TextMode = (typeof TEXT_MODES)[number];

export const TEXT_LANGUAGES = ["fr", "en"] as const;
export type TextLanguage = (typeof TEXT_LANGUAGES)[number];

export const TEXT_LENGTHS = ["short", "medium", "long"] as const;
export type TextLength = (typeof TEXT_LENGTHS)[number];

/** Limites de temps proposées à l'hôte, en secondes ; `null` = défaut de 5 min (CONF-01, H-9). */
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
  visibility: RoomVisibility;
  capacity: number;
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
  visibility: "code",
  capacity: DEFAULT_CAPACITY,
};

// ── État de la salle, diffusé en entier à chaque changement (ADR-001) ──────

/** Cycle de vie de la salle et de sa course. */
export type RoomStatus = "waiting" | "countdown" | "racing" | "results" | "closed";

export type ParticipantRole = "runner" | "spectator";

export interface Participant {
  /** `users.id` : un utilisateur n'apparaît qu'une fois, même avec plusieurs onglets. */
  userId: string;
  displayName: string;
  kind: "member" | "guest";
  role: ParticipantRole;
  /** Faux pendant le délai de grâce qui suit une déconnexion (ancien SALLE-13). */
  connected: boolean;
  /** Horodatage serveur (ms) de l'arrivée : départage « le plus ancien » (SALLE-08). */
  joinedAt: number;
}

export interface RoomState {
  code: string;
  status: RoomStatus;
  hostId: string;
  config: RoomConfig;
  /** Dans l'ordre d'arrivée. */
  participants: Participant[];
}

/**
 * Un lien d'invitation tel que l'hôte le voit (SALLE-04). Jamais dans `RoomState` : seul l'hôte
 * le reçoit, par `room:invites`. Le jeton en clair n'y figure pas, seulement un identifiant interne.
 */
export interface InviteInfo {
  id: string;
  /** Horodatage serveur (ms). */
  createdAt: number;
  status: "unused" | "used" | "revoked";
  /** Pseudonyme d'affichage de la personne liée au lien, une fois utilisé. */
  usedBy: string | null;
}

/** Une salle publique de l'explorateur (JOIN-02). La complexité (CONF-05) n'existe pas encore. */
export interface LobbyRoom {
  code: string;
  /** Coureurs humains et bots (SALLE-05). */
  runners: number;
  capacity: number;
  language: TextLanguage;
  /** Pseudonyme d'affichage de l'hôte. */
  host: string;
  status: Exclude<RoomStatus, "closed">;
  /** Rejoignable maintenant : en attente ou sur les résultats, et non pleine (SALLE-09). */
  joinable: boolean;
}

// ── Erreurs : des codes, jamais des phrases (I18N-01, I18N-02, I18N-03, traduites côté client) ──

export const ROOM_ERROR_CODES = [
  "UNAUTHENTICATED",
  "INVALID_PAYLOAD",
  "INVALID_CODE",
  "GUEST_CANNOT_CREATE",
  "ROOM_NOT_FOUND",
  "ROOM_FULL",
  "INVITE_REQUIRED",
  "INVITE_INVALID",
  "INVITE_LIMIT",
  "KICKED",
  "NO_ROOM_AVAILABLE",
  "ALREADY_IN_ROOM",
  "NOT_IN_ROOM",
  "NOT_HOST",
  "CONFIG_LOCKED",
  "RACE_NOT_ALLOWED",
  "RACE_IN_PROGRESS",
  "NOT_ENOUGH_RUNNERS",
  "NO_TEXT_AVAILABLE",
  "RACE_NOT_RUNNING",
  "INPUT_REJECTED",
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

/** Client → serveur ; les frappes seules ne demandent pas d’accusé. */
export interface ClientToServerEvents {
  /** Membre seulement (SALLE-01, AUTH-03). `{ config, role }` : hôte coureur ou spectateur. */
  "room:create": (payload: unknown, ack: (res: Ack<{ code: string }>) => void) => void;
  /** Rejoindre par code (SALLE-02, JOIN-01) comme coureur ou spectateur (SALLE-01, SALLE-05). */
  "room:join": (payload: unknown, ack: (res: Ack<{ code: string }>) => void) => void;
  /** Hôte seulement (SALLE-04) : crée un lien ; le jeton en clair n'est renvoyé qu'ici, une seule fois. */
  "room:createInvite": (payload: unknown, ack: (res: Ack<{ id: string; token: string }>) => void) => void;
  /** Entrer avec un lien d'invitation (SALLE-04), quelle que soit la visibilité de la salle. */
  "room:joinInvite": (payload: unknown, ack: (res: Ack<{ code: string }>) => void) => void;
  /** Hôte seulement (SALLE-07) : expulse et bannit un participant ou un spectateur. */
  "room:kick": (payload: unknown, ack: (res: Ack) => void) => void;
  /** Hôte seulement, en `waiting` seulement (CONF-12). */
  /** Partie rapide (JOIN-03) : entre en coureur dans la meilleure salle publique. */
  "room:quickJoin": (payload: unknown, ack: (res: Ack<{ code: string }>) => void) => void;
  /** Abonnement à la liste des salles publiques (JOIN-02) ; la liste arrive par `lobby:rooms`. */
  "lobby:subscribe": (payload: unknown, ack: (res: Ack) => void) => void;
  "lobby:unsubscribe": (payload: unknown, ack: (res: Ack) => void) => void;
  "room:updateConfig": (patch: unknown, ack: (res: Ack) => void) => void;
  "race:start": (payload: unknown, ack: (res: Ack) => void) => void;
  "race:input": (payload: unknown) => void;
  "race:abandon": (payload: unknown, ack: (res: Ack) => void) => void;
  "room:restart": (payload: unknown, ack: (res: Ack) => void) => void;
  "room:close": (payload: unknown, ack: (res: Ack) => void) => void;
  "room:leave": (ack: (res: Ack) => void) => void;
}

/** Serveur → client. */
export interface ServerToClientEvents {
  "race:records": (records: { userIds: string[] }) => void;
  "race:state": (state: ReturnType<typeof raceSnapshot>) => void;
  "race:results": (results: NonNullable<ReturnType<typeof raceResults>>) => void;
  "race:self": (self: { typed: string; keystrokes: Keystrokes }) => void;
  /** État complet, envoyé à toute la salle après chaque changement. */
  "room:state": (state: RoomState) => void;
  /** Liens d'invitation, à l'hôte seulement (SALLE-04, SALLE-08) ; jamais diffusés à la salle. */
  "room:invites": (invites: InviteInfo[]) => void;
  /** La personne vient d'être expulsée de sa salle (SALLE-07). */
  "room:kicked": () => void;
  /** Salles publiques (JOIN-02), regroupées : au plus une diffusion toutes les ~500 ms (PERF-02). */
  "lobby:rooms": (rooms: LobbyRoom[]) => void;
  /** Erreur non sollicitée (salle fermée, retrait…), hors accusé de réception. */
  "room:error": (error: RoomErrorCode) => void;
}

/** Données attachées au socket par le middleware d'authentification du serveur. */
export interface SocketData {
  user: { id: string; kind: "member" | "guest"; displayName: string };
  /** Code de la salle où se trouve l'utilisateur, s'il y en a une. */
  roomCode: string | null;
  /** Clé de l'IP du client (`ipRateLimitKey`), calculée à la connexion (SALLE-04). */
  ip: string;
}

// ── Validation des charges utiles reçues du client (TECH-07) ────────────────

/**
 * Objet « simple » (prototype `Object` ou `null`) : refuse tableaux, primitives, instances de
 * classe et tampons binaires, que `z.strictObject` accepterait seuls.
 */
const plainObject = z.custom<object>(
  (value) => value != null && [Object.prototype, null].includes(Object.getPrototypeOf(value)),
);

/**
 * Caractères qu'il est utile d'exclure : ceux que le générateur de textes peut produire.
 * Lettres latines (avec les accents du français), chiffres, ponctuation ASCII et française.
 */
const EXCLUDABLE_CHARACTER = /^[A-Za-z0-9À-ÖØ-öø-ÿŒœ!-/:-@[-`{-~«»’…–—]$/u;

/**
 * Caractères exclus (CONF-07, B-D1) : en minuscules (le générateur ignore la casse), uniques,
 * pris dans la liste ci-dessus, 30 au plus, puis **triés**. L'hôte ne choisit ni les glyphes, ni
 * la casse, ni l'ordre : la salle diffuse un jeu de caractères, jamais un mot lisible. Les
 * surrogates isolés ne sont pas dans la liste. Entrée brute de 100 unités au plus.
 */
export const excludedCharactersSchema = z
  .string()
  .refine((input) => input.length <= MAX_EXCLUDED_INPUT_LENGTH) // unités UTF-16, pas points de code
  .transform((input) => {
    const kept = new Set<string>();
    for (const character of Array.from(input.normalize("NFC").toLowerCase())) {
      if (!EXCLUDABLE_CHARACTER.test(character)) continue;
      kept.add(character);
      if (kept.size === MAX_EXCLUDED_CHARACTERS) break;
    }
    return [...kept].sort().join("");
  });

/** `null` si l'entrée brute est trop longue. */
export function normalizeExcludedCharacters(input: string): string | null {
  const result = excludedCharactersSchema.safeParse(input);
  return result.success ? result.data : null;
}

/** Champs de `RoomConfig`, tous requis ; les valeurs hors liste sont refusées. */
export const roomConfigFields = {
  textMode: z.enum(TEXT_MODES),
  language: z.enum(TEXT_LANGUAGES),
  length: z.enum(TEXT_LENGTHS),
  timeLimitSeconds: z.literal(TIME_LIMITS_SECONDS).nullable(),
  accents: z.boolean(),
  excludedCharacters: excludedCharactersSchema,
  inputMode: z.enum(INPUT_MODES),
  botCount: z
    .number()
    .int()
    .min(0)
    .max(MAX_BOTS)
    .transform((value) => value + 0), // -0 devient 0
  botDifficulty: z.enum(BOT_DIFFICULTIES),
  visibility: z.enum(ROOM_VISIBILITIES),
  capacity: z.number().int().min(MIN_CAPACITY).max(MAX_CAPACITY),
};

/**
 * Patch de configuration : refuse toute clé inconnue et toute valeur hors liste (y compris
 * `undefined` explicite) : un client modifié ne peut rien glisser d'autre dans l'état diffusé.
 */
export const roomConfigPatchSchema = plainObject.pipe(
  z.strictObject({
    textMode: roomConfigFields.textMode.exactOptional(),
    language: roomConfigFields.language.exactOptional(),
    length: roomConfigFields.length.exactOptional(),
    timeLimitSeconds: roomConfigFields.timeLimitSeconds.exactOptional(),
    accents: roomConfigFields.accents.exactOptional(),
    excludedCharacters: roomConfigFields.excludedCharacters.exactOptional(),
    inputMode: roomConfigFields.inputMode.exactOptional(),
    botCount: roomConfigFields.botCount.exactOptional(),
    botDifficulty: roomConfigFields.botDifficulty.exactOptional(),
    visibility: roomConfigFields.visibility.exactOptional(),
    capacity: roomConfigFields.capacity.exactOptional(),
  }),
);

/**
 * Patch de configuration valide, ou `null`. `undefined` ou `{}` donnent un patch vide
 * (création avec la config par défaut).
 */
export function parseRoomConfigPatch(input: unknown): RoomConfigPatch | null {
  if (input === undefined) return {};
  const result = roomConfigPatchSchema.safeParse(input);
  return result.success ? result.data : null;
}

const participantRoleSchema = z.enum(["runner", "spectator"]);

/** `{ config, role }` : configuration vide et rôle coureur par défaut, clés inconnues refusées. */
export const createPayloadSchema = plainObject
  .pipe(z.strictObject({ config: roomConfigPatchSchema.optional(), role: participantRoleSchema.optional() }))
  .transform(({ config, role }) => ({ config: config ?? {}, role: role ?? ("runner" as const) }));

/** Charge utile de `room:create` validée ; configuration vide et rôle coureur par défaut. */
export function parseCreatePayload(input: unknown): { config: RoomConfigPatch; role: ParticipantRole } | null {
  const result = createPayloadSchema.safeParse(input);
  return result.success ? result.data : null;
}

/** `{ code, role }` ; les clés en trop sont ignorées, comme avant. Le code est normalisé après. */
export const joinPayloadSchema = plainObject.pipe(z.object({ code: z.string(), role: participantRoleSchema }));

/**
 * Charge utile de `room:join` avec le code normalisé (majuscules, sans espaces), ou le
 * code d'erreur à renvoyer : `INVALID_CODE` si seul le code de salle est mal formé.
 */
export function parseJoinPayload(input: unknown): JoinPayload | "INVALID_PAYLOAD" | "INVALID_CODE" {
  const result = joinPayloadSchema.safeParse(input);
  if (!result.success) return "INVALID_PAYLOAD";
  const normalized = normalizeRoomCode(result.data.code);
  if (!isRoomCode(normalized)) return "INVALID_CODE";
  return { code: normalized, role: result.data.role };
}

/** Longueur d'un jeton d'invitation : 32 octets en base64url sans bourrage (SALLE-04). */
export const INVITE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

const inviteTokenSchema = z.string().regex(INVITE_TOKEN_PATTERN);

/** `{ token, role }` de `room:joinInvite` (SALLE-04) ; clés inconnues refusées. */
export const joinInvitePayloadSchema = plainObject.pipe(
  z.strictObject({ token: inviteTokenSchema, role: participantRoleSchema }),
);

export function parseJoinInvitePayload(input: unknown): { token: string; role: ParticipantRole } | null {
  const result = joinInvitePayloadSchema.safeParse(input);
  return result.success ? result.data : null;
}

/** `{ userId }` de `room:kick` (SALLE-07) ; identifiant d'utilisateur (UUID). */
export const kickPayloadSchema = plainObject.pipe(z.strictObject({ userId: z.uuid() }));

export function parseKickPayload(input: unknown): { userId: string } | null {
  const result = kickPayloadSchema.safeParse(input);
  return result.success ? result.data : null;
}

/** Commandes sans paramètres : objet vide strict, sans identité fournie par le client. */
export const raceCommandSchema = plainObject.pipe(z.strictObject({}));

export function parseRaceCommand(input: unknown): boolean {
  return raceCommandSchema.safeParse(input).success;
}

/** Lot borné d’unités UTF-16 ou de retours arrière (COURSE-06). */
export const raceInputSchema = plainObject.pipe(
  z.strictObject({ ops: z.array(z.string().refine((op) => op.length === 1)).max(64) }),
);

export function parseRaceInput(input: unknown): { ops: string[] } | null {
  const result = raceInputSchema.safeParse(input);
  return result.success ? result.data : null;
}
