import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { VueQueryPlugin } from '@tanstack/vue-query';
import { registerSW } from 'virtual:pwa-register';
import App from '@/app/App.vue';
import { i18n } from '@/app/i18n';
import { cacheRestored, clientPersister, queryClient, replayOfflineMutations } from '@/app/query';
import { router } from '@/app/router';
import { startRouting } from '@/app/start-routing';
import { registerAccountMutations } from '@/modules/accounts/offline';
import { useSession } from '@/modules/auth';
import { registerIncomeMutations } from '@/modules/income/offline';
import { registerProfileMutations } from '@/modules/profile/offline';
import { registerTransferMutations } from '@/modules/transfers/offline';
import { createApiClient } from '@/shared/api/client';
import { API_KEY, OWNER_KEY } from '@/shared/api/use-api';
import '@/app/styles/index.css';

registerSW({ immediate: true });

const app = createApp(App).use(createPinia()).use(i18n);

const session = useSession();

const api = createApiClient(import.meta.env.VITE_API_URL, session.getAccessToken);

/** Who every request goes as; a write parked offline records it and refuses to travel under anyone else's token. */
const ownerId = () => session.user.value?.id ?? null;

app.provide(API_KEY, api);
app.provide(OWNER_KEY, ownerId);
/**
 * A write that paused offline is restored from IndexedDB without any screen
 * behind it, so the client has to know what those mutations do before it is
 * asked to replay them. The modules say it; only the root, which owns the API
 * client, can wire it.
 */
registerAccountMutations(queryClient, api, ownerId);
registerTransferMutations(queryClient, api, ownerId);
registerIncomeMutations(queryClient, api, ownerId);
registerProfileMutations(queryClient, api, ownerId);
app.use(VueQueryPlugin, { queryClient, clientPersister });

/**
 * The guard goes on before the router is installed — installing it is what
 * starts the first navigation — and the guard reads the stored session itself,
 * so a signed-in person is never bounced to sign-in on a cold start and an
 * anonymous one reaches sign-in instead of a home screen whose queries have
 * nothing to travel with. Mounting waits for the destination to settle.
 */
void startRouting(app, router, session).finally(() => {
  app.mount('#app');
  // Only now are both halves true: the persisted cache is back (paused
  // mutations included) and the session is known, so a write made offline can
  // go out with a token behind it.
  void cacheRestored
    .then(() => replayOfflineMutations(queryClient))
    .catch((error: unknown) => {
      console.error('Could not replay the writes made offline', error);
    });
});
