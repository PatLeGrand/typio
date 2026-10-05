const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

/** Longueur maximale d'une clé : borne la mémoire quand la clé contient une saisie. */
const MAX_KEY_LENGTH = 128;
/** Écart minimal entre deux purges systématiques des entrées périmées. */
const SWEEP_INTERVAL_MS = MINUTE_MS;
const DEFAULT_MAX_KEYS = 10_000;

/**
 * Limites d'authentification. Une classe entière partage souvent une seule IP (NAT
 * d'établissement) : les plafonds par IP sont donc larges, ils ne servent qu'à borner
 * l'abus massif. La vraie protection contre la force brute est `loginFailures`, par
 * couple (IP, identifiant), complétée par `loginFailuresPerUsername` contre une attaque
 * répartie sur beaucoup d'IP. Le coût CPU et mémoire d'argon2 est borné à part, par le
 * sémaphore de `./semaphore`.
 */
export const AUTH_RATE_LIMITS = {
  /** Essais de connexion par couple (IP, identifiant) : protection contre la force brute. */
  loginFailures: { limit: 5, windowMs: 15 * MINUTE_MS },
  /**
   * Essais par identifiant, toutes IP confondues (inconnus compris) : force brute répartie.
   *
   * `maxKeys` : 100 000 identifiants suivis. Mesuré (Node, clé de 20 caractères) : environ
   * 19 Mo avec un événement par clé, environ 84 Mo si chaque clé portait déjà 50 événements,
   * ce que les plafonds par IP rendent irréaliste. Quand la table est pleine de clés encore
   * dans leur fenêtre, une NOUVELLE clé est refusée (`onFull: "refuse"`) : évincer la plus
   * ancienne ferait oublier les échecs d'une victime, et lèverait sa protection.
   */
  loginFailuresPerUsername: { limit: 50, windowMs: 15 * MINUTE_MS, maxKeys: 100_000, onFull: "refuse" },
  /** Tentatives de connexion, réussies ou non, par IP (toute une classe derrière une IP). */
  loginAttempts: { limit: 300, windowMs: 15 * MINUTE_MS },
  /** Inscriptions par IP (une classe qui s'inscrit en même temps). */
  registrations: { limit: 60, windowMs: HOUR_MS },
  /** Créations d'invité par IP (une classe, plusieurs parties dans l'heure). */
  guests: { limit: 120, windowMs: HOUR_MS },
  /** Départs d'une connexion GitHub ou Discord par IP (AUTH-2, AUTH-3) : borne l'abus massif. */
  oauthStarts: { limit: 60, windowMs: 15 * MINUTE_MS },
} as const;

export interface RateLimiterOptions {
  limit: number;
  windowMs: number;
  /** Horloge injectée, en millisecondes (`Date.now` par défaut). */
  now?: () => number;
  /** Nombre maximal de clés suivies. */
  maxKeys?: number;
  /**
   * Que faire quand `maxKeys` clés encore vivantes sont suivies et qu'une nouvelle arrive :
   * `evict-oldest` (défaut) écarte la clé la moins récemment écrite ; `refuse` garde toutes
   * les clés vivantes, `consume` refuse la nouvelle clé (renvoie faux) et `record` l'ignore.
   */
  onFull?: "evict-oldest" | "refuse";
}

export interface RateLimiter {
  /** Vrai si `limit` événements sont déjà dans la fenêtre ; n'enregistre rien. */
  isLimited(key: string): boolean;
  /** Enregistre un événement. */
  record(key: string): void;
  /**
   * Si la limite n'est pas atteinte, enregistre un événement et renvoie vrai ; sinon faux
   * (aussi faux pour une nouvelle clé quand la table est pleine en mode `refuse`).
   * Synchrone : c'est ce qui permet de réserver un essai avant tout `await`.
   */
  consume(key: string): boolean;
  /** Rend le dernier essai réservé (par `consume`) pour cette clé, s'il y en a un. */
  release(key: string): void;
  reset(key: string): void;
  /** Nombre de clés suivies (utilisé par les tests pour vérifier la purge et la borne). */
  size(): number;
}

/**
 * Limiteur à fenêtre glissante, en mémoire : un journal d'horodatages par clé. Chaque
 * clé garde au plus `limit` horodatages, et le nombre de clés est borné (`maxKeys`).
 * Il vit dans un seul processus : une seconde instance de `web` aurait ses propres compteurs.
 */
export function createRateLimiter(options: RateLimiterOptions): RateLimiter {
  const { limit, windowMs, now = Date.now, maxKeys = DEFAULT_MAX_KEYS, onFull = "evict-oldest" } = options;
  // Un `Map` garde l'ordre d'insertion : on réinsère à chaque écriture, la plus ancienne vient en tête.
  const entries = new Map<string, number[]>();
  let lastSweep = now();

  function normalize(key: string): string {
    return key.length > MAX_KEY_LENGTH ? key.slice(0, MAX_KEY_LENGTH) : key;
  }

  /** Horodatages encore dans la fenêtre, ou `undefined` (et l'entrée est retirée) s'il n'en reste aucun. */
  function live(key: string, at: number): number[] | undefined {
    const timestamps = entries.get(key);
    if (!timestamps) return undefined;
    const fresh = timestamps.filter((timestamp) => timestamp > at - windowMs);
    if (fresh.length === 0) {
      entries.delete(key);
      return undefined;
    }
    if (fresh.length !== timestamps.length) entries.set(key, fresh);
    return fresh;
  }

  /** Retire toutes les entrées périmées. Parcours complet : au plus une fois par intervalle. */
  function sweep(at: number): void {
    for (const key of [...entries.keys()]) live(key, at);
    lastSweep = at;
  }

  function maybeSweep(at: number): void {
    if (at - lastSweep >= SWEEP_INTERVAL_MS) sweep(at);
  }

  /**
   * Fait de la place pour une nouvelle clé : d'abord les périmées (balayage au plus une fois
   * par intervalle : sinon un flot de clés nouvelles ferait un parcours complet à chaque
   * requête), puis selon `onFull` la moins récemment écrite (O(1)) ou rien. Renvoie faux si
   * la place n'a pas pu être faite.
   */
  function makeRoom(at: number): boolean {
    if (entries.size < maxKeys) return true;
    maybeSweep(at);
    if (onFull === "refuse") return entries.size < maxKeys;
    while (entries.size >= maxKeys) {
      const oldest = entries.keys().next();
      if (oldest.done) break;
      entries.delete(oldest.value);
    }
    return true;
  }

  /** Enregistre un événement ; faux si la clé est nouvelle et que la table pleine la refuse. */
  function write(key: string, at: number): boolean {
    const fresh = live(key, at) ?? [];
    if (fresh.length === 0 && !makeRoom(at)) return false;
    fresh.push(at);
    if (fresh.length > limit) fresh.splice(0, fresh.length - limit);
    entries.delete(key);
    entries.set(key, fresh);
    return true;
  }

  return {
    isLimited(rawKey) {
      const at = now();
      maybeSweep(at);
      return (live(normalize(rawKey), at)?.length ?? 0) >= limit;
    },
    record(rawKey) {
      const at = now();
      maybeSweep(at);
      write(normalize(rawKey), at);
    },
    consume(rawKey) {
      const at = now();
      maybeSweep(at);
      const key = normalize(rawKey);
      if ((live(key, at)?.length ?? 0) >= limit) return false;
      return write(key, at);
    },
    release(rawKey) {
      const key = normalize(rawKey);
      const timestamps = entries.get(key);
      if (!timestamps) return;
      timestamps.pop();
      if (timestamps.length === 0) entries.delete(key);
    },
    reset(rawKey) {
      entries.delete(normalize(rawKey));
    },
    size() {
      return entries.size;
    },
  };
}

export interface AuthLimiters {
  loginFailures: RateLimiter;
  loginFailuresPerUsername: RateLimiter;
  loginAttempts: RateLimiter;
  registrations: RateLimiter;
  guests: RateLimiter;
  oauthStarts: RateLimiter;
}

export function createAuthLimiters(now: () => number = Date.now): AuthLimiters {
  return {
    loginFailures: createRateLimiter({ ...AUTH_RATE_LIMITS.loginFailures, now }),
    loginFailuresPerUsername: createRateLimiter({ ...AUTH_RATE_LIMITS.loginFailuresPerUsername, now }),
    loginAttempts: createRateLimiter({ ...AUTH_RATE_LIMITS.loginAttempts, now }),
    registrations: createRateLimiter({ ...AUTH_RATE_LIMITS.registrations, now }),
    guests: createRateLimiter({ ...AUTH_RATE_LIMITS.guests, now }),
    oauthStarts: createRateLimiter({ ...AUTH_RATE_LIMITS.oauthStarts, now }),
  };
}

/** Clé du limiteur d'échecs : le même IP sur deux identifiants a deux compteurs. */
export function loginFailureKey(ipKey: string, username: string): string {
  return `${ipKey}|${username}`;
}

const IPV4_PATTERN = /^\d{1,3}(?:\.\d{1,3}){3}$/;

/**
 * Lit les groupes de 16 bits d'une adresse IPv6 (compression `::` et IPv4 finale comprises).
 * Renvoie `undefined` si le texte n'est pas une IPv6 valide.
 */
function parseIpv6Groups(address: string): number[] | undefined {
  const halves = address.split("::");
  if (halves.length > 2) return undefined;

  const toGroups = (part: string): number[] | undefined => {
    if (part === "") return [];
    const groups: number[] = [];
    const pieces = part.split(":");
    for (const [index, piece] of pieces.entries()) {
      if (index === pieces.length - 1 && IPV4_PATTERN.test(piece)) {
        const octets = piece.split(".").map(Number);
        if (octets.some((octet) => octet > 255)) return undefined;
        groups.push((octets[0] << 8) | octets[1], (octets[2] << 8) | octets[3]);
      } else if (/^[0-9a-f]{1,4}$/.test(piece)) {
        groups.push(Number.parseInt(piece, 16));
      } else {
        return undefined;
      }
    }
    return groups;
  };

  const head = toGroups(halves[0]);
  if (!head) return undefined;
  if (halves.length === 1) return head.length === 8 ? head : undefined;

  const tail = toGroups(halves[1]);
  if (!tail || head.length + tail.length > 7) return undefined;
  return [...head, ...new Array<number>(8 - head.length - tail.length).fill(0), ...tail];
}

/**
 * Clé de limitation d'une adresse : une IPv4 (ou IPv4 « mappée » dans une IPv6) reste
 * entière ; une IPv6 est regroupée par préfixe /64, car un client en contrôle tout le
 * reste et changerait d'adresse à volonté pour échapper aux compteurs.
 */
export function ipRateLimitKey(ip: string): string {
  const address = ip.trim().replace(/^\[|\]$/g, "").split("%")[0].toLowerCase();
  if (!address.includes(":")) return address;

  const groups = parseIpv6Groups(address);
  if (!groups) return address;

  const isV4Mapped = groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xffff;
  if (isV4Mapped) {
    return `${groups[6] >> 8}.${groups[6] & 0xff}.${groups[7] >> 8}.${groups[7] & 0xff}`;
  }
  return `${groups.slice(0, 4).map((group) => group.toString(16)).join(":")}::/64`;
}

interface HeaderReader {
  get(name: string): string | null;
}

/**
 * IP du client : premier élément de `x-forwarded-for`, sinon `unknown`.
 *
 * Hypothèse d'infrastructure : Caddy est devant `web` (lié à 127.0.0.1, injoignable
 * autrement), et Caddy 2.5 et suivants remplace `x-forwarded-for` envoyé par un client non
 * approuvé : le premier élément est alors l'adresse réellement vue par Caddy. Sans ce
 * proxy, l'en-tête serait forgeable. `x-real-ip` n'est volontairement pas lu : Caddy ne le
 * pose pas, un client pourrait donc l'imposer.
 */
export function getClientIp(headers: HeaderReader): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded ? forwarded.slice(0, 64) : "unknown";
}
