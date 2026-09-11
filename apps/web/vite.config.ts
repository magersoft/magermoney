import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import Icons from 'unplugin-icons/vite';
import { alias } from './vite.alias';

export default defineConfig(({ mode }) => {
  // `import.meta.env` does not exist while the config is being evaluated, so the
  // API origin the service worker caches comes from the env files directly.
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const apiOrigin = env.VITE_API_URL ? new URL(env.VITE_API_URL).origin : undefined;

  return {
    plugins: [
      vue(),
      tailwindcss(),
      Icons({ compiler: 'vue3' }),
      VitePWA({
        registerType: 'autoUpdate',
        manifest: {
          name: 'Magermoney',
          short_name: 'Magermoney',
          lang: 'ru',
          start_url: '/',
          display: 'standalone',
          background_color: '#101418',
          theme_color: '#101418',
          icons: [
            { src: '/icons/192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icons/512.png', sizes: '512x512', type: 'image/png' },
            { src: '/icons/maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        // Without this the manifest and the worker only exist in a build, so a
        // PWA problem is only ever found after `vite build`.
        devOptions: { enabled: true, type: 'module', suppressWarnings: true },
        workbox: {
          navigateFallback: '/index.html',
          runtimeCaching: [
            {
              urlPattern: ({ url }) => apiOrigin !== undefined && url.origin === apiOrigin,
              handler: 'NetworkFirst',
              options: { cacheName: 'api', networkTimeoutSeconds: 4 },
            },
          ],
        },
      }),
    ],
    resolve: { alias },
    server: { port: 5173 },
  };
});
