import postgres from 'postgres';

export type Sql = ReturnType<typeof createDb>;

export const createDb = (url: string) =>
  postgres(url, {
    transform: postgres.camel,
    max: 5,
    idle_timeout: 20,
    prepare: false,
    types: { numeric: { to: 1700, from: [1700], serialize: (v: string) => v, parse: (v: string) => v } },
  });
