import type { createRoomStore, RoomResult, UserContext } from "./roomStore";
import type { RoomMembershipRepository } from "./roomMembershipRepository";

/** Frontière asynchrone : réserver avant l'ajout, libérer après le retrait.
 * Les mutations d'appartenance sont sérialisées pour préserver les règles synchrones
 * du registre, y compris deux onglets qui entrent simultanément dans la même salle.
 */
export function createPersistentRoomStore(store: ReturnType<typeof createRoomStore>, memberships: RoomMembershipRepository) {
  let pending = Promise.resolve();
  function serialize(run: () => Promise<RoomResult>): Promise<RoomResult> {
    const result = pending.then(run);
    pending = result.then(() => {}, () => {});
    return result;
  }

  async function enter(user: UserContext, code: string, at: number, run: () => RoomResult): Promise<RoomResult> {
    const current = store.roomOf(user.id);
    if (current) return run(); // le registre gère la reconnexion et ALREADY_IN_ROOM
    if (!await memberships.reserve(user.id, code, new Date(at))) {
      // Écrivain unique : sans appartenance en mémoire, la réservation est orpheline.
      await memberships.releaseAny(user.id);
      if (!await memberships.reserve(user.id, code, new Date(at))) return { ok: false, error: "ALREADY_IN_ROOM" };
    }
    let admitted = false;
    try {
      const result = run();
      admitted = result.ok;
      return result;
    } finally {
      if (!admitted) {
        await memberships.release(user.id, code)
          .catch(() => console.error("[realtime] membership release failed"));
      }
    }
  }

  async function remove(code: string, run: () => RoomResult): Promise<RoomResult> {
    const previous = store.get(code);
    const result = run();
    if (result.ok && previous) {
      for (const participant of previous.participants) {
        if (store.roomOf(participant.userId) !== code) {
          await memberships.release(participant.userId, code)
            .catch(() => console.error("[realtime] membership release failed"));
        }
      }
    }
    return result;
  }

  return {
    ...store,
    create(...args: Parameters<typeof store.create>) {
      return serialize(async () => {
        if (args[0].kind === "guest" || store.roomOf(args[0].id)) return store.create(...args);
        const code = store.allocateCode();
        return enter(args[0], code, args[3], () => store.create(args[0], args[1], args[2], args[3], code));
      });
    },
    join(...args: Parameters<typeof store.join>) {
      return serialize(() => enter(args[0], args[1], args[3], () => store.join(...args)));
    },
    joinInvite(...args: Parameters<typeof store.joinInvite>) {
      return serialize(async () => {
        const code = store.inviteCode(args[1]);
        if (!code) return store.joinInvite(...args);
        return enter(args[0], code, args[4], () => store.joinInvite(...args));
      });
    },
    leave(...args: Parameters<typeof store.leave>) {
      return serialize(() => remove(args[1], () => store.leave(...args)));
    },
    kick(...args: Parameters<typeof store.kick>) {
      return serialize(() => remove(args[1], () => store.kick(...args)));
    },
    expire(...args: Parameters<typeof store.expire>) {
      return serialize(async () => {
        const state = store.get(args[1]);
        // Une reconnexion peut annuler la grâce pendant l'attente d'une autre écriture.
        if (state?.participants.some((p) => p.userId === args[0] && p.connected)) return { ok: false, error: "NOT_IN_ROOM" };
        return remove(args[1], () => store.expire(...args));
      });
    },
    finish(...args: Parameters<typeof store.finish>) {
      return serialize(() => remove(args[1], () => store.finish(...args)));
    },
  };
}
