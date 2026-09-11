/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

/** The app version, injected by Vite from package.json. Busts the query cache. */
declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
