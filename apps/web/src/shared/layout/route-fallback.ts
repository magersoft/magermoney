/* eslint-disable vue/one-component-per-file -- the loading and error views are two render
   functions of three lines each; giving them SFCs of their own would scatter one idea over
   three files. */
import {
  defineAsyncComponent,
  defineComponent,
  h,
  type AsyncComponentLoader,
  type Component,
} from 'vue';
import { useI18n } from 'vue-i18n';
import { RouteError, RouteLoading } from '@magermoney/ui';

/**
 * A routed screen is a chunk of its own, and after a deploy the chunk a running
 * tab asks for no longer exists. Without a fallback the content area just stays
 * blank. Every module barrel wraps its pages in `routeComponent`, so a missing
 * chunk becomes a sentence and a Reload button, and a slow one becomes a
 * skeleton instead of nothing.
 */

/** Behind an object so a test can replace it: `location.reload` cannot be spied on in every DOM. */
export const pageReloader = {
  reload(): void {
    window.location.reload();
  },
};

const LoadingView = defineComponent({
  name: 'RouteLoadingView',
  setup() {
    const { t } = useI18n();
    return () => h(RouteLoading, { label: t('route.loading') });
  },
});

const ErrorView = defineComponent({
  name: 'RouteErrorView',
  setup() {
    const { t } = useI18n();
    return () =>
      h(RouteError, {
        title: t('route.failed'),
        actionLabel: t('route.reload'),
        onRetry: () => pageReloader.reload(),
      });
  },
});

/** 200ms before the skeleton: a chunk already in the HTTP cache must not flash one. */
const LOADING_DELAY_MS = 200;

export function routeComponent(loader: AsyncComponentLoader): Component {
  return defineAsyncComponent({
    loader,
    loadingComponent: LoadingView,
    errorComponent: ErrorView,
    delay: LOADING_DELAY_MS,
  });
}

const CHUNK_ERRORS = [
  'Failed to fetch dynamically imported module', // Chromium
  'error loading dynamically imported module', // Firefox
  'Importing a module script failed', // Safari
];

/**
 * A module barrel is itself loaded lazily by the router, and that import fails
 * before any `routeComponent` exists to catch it. The router's `onError` uses
 * this to tell "the file is gone" from a real bug.
 */
export function isChunkLoadError(error: unknown): boolean {
  return error instanceof Error && CHUNK_ERRORS.some((m) => error.message.includes(m));
}
