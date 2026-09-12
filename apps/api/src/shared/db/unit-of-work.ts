/**
 * Runs `fn` with a set of repositories bound to one transaction. The pg
 * implementation opens `sql.begin`; the in-memory one just hands over the same
 * repositories, which is enough for use-case tests.
 */
export type UnitOfWork<R> = <T>(fn: (repos: R) => Promise<T>) => Promise<T>;

export const memoryUnitOfWork =
  <R>(repos: R): UnitOfWork<R> =>
  (fn) =>
    fn(repos);
