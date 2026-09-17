import { watch, type Ref } from 'vue';

/**
 * What became of a write: it reached the API, or it is parked on the device
 * until there is a connection again.
 */
export type WriteOutcome = 'sent' | 'parked';

/**
 * A mutation paused with no network never settles — its promise waits for the
 * connection, which can be hours. A form awaiting that promise would stay open
 * with its button spinning, so a parked write resolves here instead: the screen
 * closes and says the write is kept. A real failure still rejects.
 */
export function settledOrParked(
  settled: Promise<unknown>,
  isPaused: Ref<boolean>,
): Promise<WriteOutcome> {
  return new Promise<WriteOutcome>((resolve, reject) => {
    const stop = watch(
      isPaused,
      (paused) => {
        if (paused) {
          stop();
          resolve('parked');
        }
      },
      { immediate: true },
    );
    settled.then(
      () => {
        stop();
        resolve('sent');
      },
      (error: unknown) => {
        stop();
        // After a park this is a no-op, and it is also what keeps the eventual
        // rejection of a resumed mutation from going unhandled.
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

/**
 * A write that was made by another account. Not a network failure, so the retry
 * policy drops it instead of sending it: it is never retried, and never sent.
 */
export class ForeignWriteError extends Error {
  constructor() {
    super('This write was made by another account');
    this.name = 'ForeignWriteError';
  }
}

/**
 * A parked write outlives the session that made it — the tab can be closed,
 * signed out and signed in as somebody else before it ever goes out. The write
 * carries the id of the account that made it, and refuses to travel under
 * anyone else's token (or with no session at all).
 */
export function assertOwner(ownerId: string | null, signedIn: string | null): void {
  if (ownerId !== signedIn) throw new ForeignWriteError();
}
