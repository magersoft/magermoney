import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { VueQueryPlugin } from '@tanstack/vue-query';
import { registerSW } from 'virtual:pwa-register';
import App from '@/app/App.vue';
import { i18n } from '@/app/i18n';
import { queryClient } from '@/app/query';
import { router } from '@/app/router';
import '@/app/styles/index.css';

registerSW({ immediate: true });

createApp(App)
  .use(createPinia())
  .use(router)
  .use(i18n)
  .use(VueQueryPlugin, { queryClient })
  .mount('#app');
