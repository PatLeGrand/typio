import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  real,
  smallint,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import type { RoomConfig } from "@/realtime/protocol";

/**
 * Comptes : membres (AUTH-01, TEST-03) et invités (AUTH-02, AUTH-03, H-2) dans la même table.
 * Un invité a une ligne pour pouvoir ouvrir une session et figurer sur un podium ;
 * `expires_at` borne sa durée de vie. Voir docs/ARCHITECTURE.md (Modèle de données).
 *
 * Aucune extension PostgreSQL (base partagée) : `uuid` vient de `gen_random_uuid()`
 * natif, et l'unicité sans casse du pseudo passe par un index sur `lower(username)`.
 */
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: text("kind").notNull(),
    username: text("username"),
    displayName: text("display_name").notNull(),
    passwordHash: text("password_hash"),
    keyboardLayout: text("keyboard_layout").notNull().default("qwerty"),
    locale: text("locale").notNull().default("fr"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("users_username_lower_idx").on(sql`lower(${table.username})`),
    index("users_guest_expires_at_idx")
      .on(table.expiresAt)
      .where(sql`${table.kind} = 'guest'`),
    check("users_kind_check", sql`${table.kind} in ('member', 'guest')`),
    check(
      "users_keyboard_layout_check",
      sql`${table.keyboardLayout} in ('qwerty', 'azerty', 'cmf')`,
    ),
    check("users_locale_check", sql`${table.locale} in ('fr', 'en')`),
    // Défense en profondeur : la validation applicative borne déjà ces longueurs.
    check("users_username_length_check", sql`char_length(${table.username}) <= 20`),
    check("users_display_name_length_check", sql`char_length(${table.displayName}) <= 40`),
    // Un membre a toujours un identifiant ; son mot de passe est facultatif, car un compte
    // créé par GitHub ou Discord (AUTH-01) n'en a pas. Un invité n'a ni l'un ni l'autre.
    check(
      "users_kind_columns_check",
      sql`(${table.kind} = 'member' and ${table.username} is not null)
        or (${table.kind} = 'guest' and ${table.username} is null and ${table.passwordHash} is null and ${table.expiresAt} is not null)`,
    ),
  ],
);

/**
 * Sessions maison (ADR-001) : l'identifiant est le SHA-256 hexadécimal du jeton du
 * cookie. Le jeton brut n'est jamais stocké ; le service temps réel lit cette table
 * pour authentifier les connexions WebSocket.
 */
export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("sessions_user_id_idx").on(table.userId),
    index("sessions_expires_at_idx").on(table.expiresAt),
  ],
);

/**
 * Comptes GitHub et Discord reliés à un membre (AUTH-01). On ne garde QUE le
 * fournisseur et l'identifiant numérique stable du compte chez lui : ni login, ni e-mail,
 * ni avatar, ni jeton. La clé (provider, provider_account_id) empêche qu'un même compte
 * externe ouvre deux comptes Typio.
 */
export const oauthAccounts = pgTable(
  "oauth_accounts",
  {
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.provider, table.providerAccountId] }),
    index("oauth_accounts_user_id_idx").on(table.userId),
    // Un membre n'a au plus qu'un compte par fournisseur (défense en profondeur : aucun chemin
    // applicatif ne relie un compte à un membre existant pour l'instant).
    uniqueIndex("oauth_accounts_user_provider_idx").on(table.userId, table.provider),
    check("oauth_accounts_provider_check", sql`${table.provider} in ('github', 'discord')`),
  ],
);

/** Courses terminées (RES-05) : une seule écriture en fin de course (PERF-02). */
export const races = pgTable("races", {
  id: uuid("id").primaryKey().defaultRandom(),
  roomCode: text("room_code").notNull(),
  hostId: uuid("host_id").references(() => users.id, { onDelete: "set null" }),
  config: jsonb("config").$type<RoomConfig>().notNull(),
  text: text("text").notNull(),
  participantCount: smallint("participant_count").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }).notNull(),
});

/** Résultats des membres seulement (H-24) : ni pseudo invité, ni saisie brute, ni IP. */
export const raceResults = pgTable("race_results", {
  id: uuid("id").primaryKey().defaultRandom(),
  raceId: uuid("race_id").notNull().references(() => races.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  rank: smallint("rank").notNull(),
  status: text("status").$type<"finished" | "unfinished" | "abandoned">().notNull(),
  wpm: real("wpm").notNull(),
  grossWpm: real("gross_wpm").notNull(),
  accuracy: real("accuracy").notNull(),
  errors: integer("errors").notNull(),
  durationMs: integer("duration_ms").notNull(),
  progress: real("progress").notNull(),
  wpmSeries: jsonb("wpm_series").$type<number[]>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("race_results_user_created_at_idx").on(table.userId, table.createdAt.desc()),
  uniqueIndex("race_results_race_user_idx").on(table.raceId, table.userId),
  check("race_results_status_check", sql`${table.status} in ('finished', 'unfinished', 'abandoned')`),
  check("race_results_progress_check", sql`${table.progress} >= 0 and ${table.progress} <= 1`),
]);
