import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { VueQueryPlugin } from '@tanstack/vue-query';
import { registerSW } from 'virtual:pwa-register';
import App from '@/app/App.vue';
import { i18n } from '@/app/i18n';
import { clientPersister, queryClient } from '@/app/query';
import { router } from '@/app/router';
import { authGuard, useSession, useSessionStore } from '@/modules/auth';
import { createApiClient } from '@/shared/api/client';
import { API_KEY } from '@/shared/api/use-api';
import '@/app/styles/index.css';

registerSW({ immediate: true });

const app = createApp(App).use(createPinia()).use(router).use(i18n);

const session = useSession();

app.provide(API_KEY, createApiClient(import.meta.env.VITE_API_URL, session.getAccessToken));
app.use(VueQueryPlugin, { queryClient, clientPersister });

/**
 * The stored session is read before the first navigation, so a signed-in person
 * is never bounced to sign-in on a cold start, and the app is mounted only once
 * the guard can answer.
 */
void useSessionStore()
  .init()
  .catch((error: unknown) => {
    // Reading the stored session can fail on its own — blocked storage, a
    // private window, a corrupt entry. Mount anyway: the guard then treats the
    // person as signed out, which is recoverable. A blank page is not.
    console.error('Could not restore the session; starting signed out', error);
  })
  .finally(() => {
    router.beforeEach(authGuard(session));
    app.mount('#app');
  });
