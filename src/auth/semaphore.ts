/** La file d'attente est pleine : la demande est refusée sans être exécutée. */
export class QueueFullError extends Error {
  constructor() {
    super("QUEUE_FULL");
    this.name = "QueueFullError";
  }
}

export interface SemaphoreOptions {
  /** Nombre maximal de tâches simultanées. */
  maxConcurrent: number;
  /** Nombre maximal de tâches en attente ; au-delà, `run` est refusé. */
  maxQueue: number;
}

export interface Semaphore {
  /**
   * Exécute `task` dès qu'une place est libre. Les tâches en attente passent dans l'ordre
   * d'arrivée (FIFO). Rejette avec `QueueFullError`, sans lancer `task`, si la file est pleine.
   * La place est toujours rendue, y compris quand `task` lève une exception.
   */
  run<T>(task: () => Promise<T>): Promise<T>;
  /** Tâches en cours d'exécution (observé par les tests et utile à la supervision). */
  active(): number;
  /** Tâches en attente d'une place (observé par les tests et utile à la supervision). */
  queued(): number;
}

export function createSemaphore({ maxConcurrent, maxQueue }: SemaphoreOptions): Semaphore {
  let active = 0;
  const waiting: (() => void)[] = [];

  return {
    async run<T>(task: () => Promise<T>): Promise<T> {
      if (active < maxConcurrent) {
        active += 1;
      } else {
        if (waiting.length >= maxQueue) throw new QueueFullError();
        // La place est transmise directement par la tâche qui se termine : `active` ne
        // redescend pas entre-temps, donc un nouvel arrivant ne peut pas doubler la file.
        await new Promise<void>((resolve) => waiting.push(resolve));
      }

      try {
        return await task();
      } finally {
        const next = waiting.shift();
        if (next) next();
        else active -= 1;
      }
    },
    active: () => active,
    queued: () => waiting.length,
  };
}
