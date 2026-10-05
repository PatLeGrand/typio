import { describe, expect, it } from "vitest";
import { createSemaphore, QueueFullError } from "./semaphore";

/** Tâche dont on décide quand elle se termine. */
function deferredTask<T = void>() {
  let finish!: (value: T) => void;
  let fail!: (error: unknown) => void;
  const promise = new Promise<T>((resolve, reject) => {
    finish = resolve;
    fail = reject;
  });
  return { promise, finish, fail };
}

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe("createSemaphore", () => {
  it("runs up to maxConcurrent tasks at once", async () => {
    const semaphore = createSemaphore({ maxConcurrent: 4, maxQueue: 64 });
    const started: number[] = [];
    const tasks = Array.from({ length: 4 }, () => deferredTask());

    tasks.forEach((task, index) => {
      void semaphore.run(() => {
        started.push(index);
        return task.promise;
      });
    });
    await flush();

    expect(started).toEqual([0, 1, 2, 3]);
    expect(semaphore.active()).toBe(4);
    expect(semaphore.queued()).toBe(0);
  });

  it("makes the 5th call wait until one of the first 4 finishes", async () => {
    const semaphore = createSemaphore({ maxConcurrent: 4, maxQueue: 64 });
    const first = Array.from({ length: 4 }, () => deferredTask());
    first.forEach((task) => void semaphore.run(() => task.promise));
    let fifthStarted = false;
    const fifth = semaphore.run(async () => {
      fifthStarted = true;
      return "done";
    });
    await flush();

    expect(fifthStarted).toBe(false);
    expect(semaphore.queued()).toBe(1);
    expect(semaphore.active()).toBe(4);

    first[2].finish();
    await flush();

    expect(fifthStarted).toBe(true);
    expect(await fifth).toBe("done");
    expect(semaphore.queued()).toBe(0);
  });

  it("never exceeds maxConcurrent while draining a queue", async () => {
    const semaphore = createSemaphore({ maxConcurrent: 4, maxQueue: 64 });
    let running = 0;
    let peak = 0;

    await Promise.all(
      Array.from({ length: 30 }, () =>
        semaphore.run(async () => {
          running += 1;
          peak = Math.max(peak, running);
          await flush();
          running -= 1;
        }),
      ),
    );

    expect(peak).toBe(4);
    expect(semaphore.active()).toBe(0);
  });

  it("serves waiting tasks in FIFO order", async () => {
    const semaphore = createSemaphore({ maxConcurrent: 1, maxQueue: 64 });
    const blocker = deferredTask();
    const order: string[] = [];
    void semaphore.run(() => blocker.promise);

    const waiting = ["a", "b", "c", "d"].map((name) =>
      semaphore.run(async () => {
        order.push(name);
      }),
    );
    await flush();
    expect(order).toEqual([]);

    blocker.finish();
    await Promise.all(waiting);

    expect(order).toEqual(["a", "b", "c", "d"]);
  });

  it("does not let a newcomer overtake the queue when a slot frees up", async () => {
    const semaphore = createSemaphore({ maxConcurrent: 1, maxQueue: 64 });
    const blocker = deferredTask();
    const order: string[] = [];
    void semaphore.run(() => blocker.promise);
    const queued = semaphore.run(async () => void order.push("queued"));

    blocker.finish();
    const newcomer = semaphore.run(async () => void order.push("newcomer"));
    await Promise.all([queued, newcomer]);

    expect(order).toEqual(["queued", "newcomer"]);
  });

  it("refuses with QueueFullError, without running the task, when the queue is full", async () => {
    const semaphore = createSemaphore({ maxConcurrent: 4, maxQueue: 64 });
    const blockers = Array.from({ length: 4 }, () => deferredTask());
    blockers.forEach((task) => void semaphore.run(() => task.promise));
    const queued = Array.from({ length: 64 }, () => semaphore.run(async () => "ok"));
    await flush();
    expect(semaphore.queued()).toBe(64);

    let overflowRan = false;
    await expect(
      semaphore.run(async () => {
        overflowRan = true;
      }),
    ).rejects.toBeInstanceOf(QueueFullError);

    expect(overflowRan).toBe(false);
    expect(semaphore.queued()).toBe(64);

    blockers.forEach((task) => task.finish());
    expect(await Promise.all(queued)).toHaveLength(64);
    expect(semaphore.active()).toBe(0);
  });

  it("accepts new work again once the queue has room", async () => {
    const semaphore = createSemaphore({ maxConcurrent: 1, maxQueue: 1 });
    const blocker = deferredTask();
    void semaphore.run(() => blocker.promise);
    const queued = semaphore.run(async () => "queued");
    await expect(semaphore.run(async () => "overflow")).rejects.toBeInstanceOf(QueueFullError);

    blocker.finish();
    await queued;

    expect(await semaphore.run(async () => "later")).toBe("later");
  });

  it("frees the slot when a task throws, and hands it to the next waiter", async () => {
    const semaphore = createSemaphore({ maxConcurrent: 1, maxQueue: 64 });
    const failing = deferredTask();
    const crashed = semaphore.run(() => failing.promise);
    const next = semaphore.run(async () => "next ran");
    await flush();
    expect(semaphore.queued()).toBe(1);

    failing.fail(new Error("argon2 exploded"));

    await expect(crashed).rejects.toThrow("argon2 exploded");
    expect(await next).toBe("next ran");
    expect(semaphore.active()).toBe(0);
  });

  it("frees the slot when a task throws synchronously", async () => {
    const semaphore = createSemaphore({ maxConcurrent: 1, maxQueue: 0 });

    await expect(
      semaphore.run(() => {
        throw new Error("sync failure");
      }),
    ).rejects.toThrow("sync failure");

    expect(semaphore.active()).toBe(0);
    expect(await semaphore.run(async () => "still works")).toBe("still works");
  });

  it("returns the task result", async () => {
    const semaphore = createSemaphore({ maxConcurrent: 2, maxQueue: 2 });
    expect(await semaphore.run(async () => 42)).toBe(42);
  });
});
