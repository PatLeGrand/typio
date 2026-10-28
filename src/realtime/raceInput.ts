/** Diff du champ par points de code ; le serveur ne reçoit que des frappes. */
export function raceInputOps(previous: string, next: string): string[] {
  const before = Array.from(previous);
  const after = Array.from(next);
  let common = 0;
  while (common < before.length && common < after.length && before[common] === after[common]) common++;
  return [...Array<string>(before.length - common).fill("\b"), ...after.slice(common)];
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
