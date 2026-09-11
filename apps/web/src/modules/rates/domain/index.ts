/** Today in the API's own date format. The rate table is always dated. */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
