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
