import { describe, expect, it } from 'vitest';
import { QueryClient } from '@tanstack/vue-query';
import { PERSIST_MAX_AGE, persistOptions, persister } from '../src/app/query';
import pkg from '../package.json';

describe('query persistence', () => {
  it('busts the restored cache with the app version', () => {
    // A release whose queries changed shape must not hydrate the previous one's
    // cache; the version is the only thing that always moves between releases.
    expect(persistOptions(new QueryClient()).buster).toBe(pkg.version);
  });

  it('persists through the given client, persister and window', () => {
    const client = new QueryClient();

    const options = persistOptions(client);

    expect(options.queryClient).toBe(client);
    expect(options.persister).toBe(persister);
    expect(options.maxAge).toBe(PERSIST_MAX_AGE);
  });
});
