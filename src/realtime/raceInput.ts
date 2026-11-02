/** Diff du champ par unités UTF-16 ; le serveur ne reçoit que des frappes. */
export function raceInputOps(previous: string, next: string): string[] {
  let common = 0;
  while (common < previous.length && common < next.length && previous[common] === next[common]) common++;
  return [...Array<string>(previous.length - common).fill("\b"), ...next.slice(common).split("")];
}

/** Un message de 64 opérations maximum par tranche de 100 ms (PERF-02). */
export function createRaceInputBuffer(send: (ops: string[]) => void) {
  let pending: string[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  function schedule() {
    if (timer !== null || pending.length === 0) return;
    timer = setTimeout(() => {
      timer = null;
      const batch = pending.splice(0, 64);
      send(batch);
      schedule();
    }, 100);
  }
  return {
    push(ops: readonly string[]) {
      pending.push(...ops);
      schedule();
    },
    clear() {
      pending = [];
      if (timer !== null) clearTimeout(timer);
      timer = null;
    },
  };
}
