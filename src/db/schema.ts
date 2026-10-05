import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Comptes : membres (AUTH-1) et invités (AUTH-4, H-2) dans la même table.
 * Un invité a une ligne pour pouvoir ouvrir une session et figurer sur un podium ;
 * `expires_at` borne sa durée de vie. Voir docs/architecture/modele-de-donnees.md.
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
    check(
      "users_kind_columns_check",
      sql`(${table.kind} = 'member' and ${table.username} is not null and ${table.passwordHash} is not null)
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
