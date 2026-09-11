import { fileURLToPath, URL } from 'node:url';
import type { Alias } from 'vite';

const appSrc = (): string => fileURLToPath(new URL('./src/', import.meta.url));
const uiSrc = (path: string): string =>
  fileURLToPath(new URL(`../../packages/ui/src/${path}`, import.meta.url));

/**
 * `@magermoney/ui` ships source, and its shadcn components resolve their own
 * `@/` alias. Those two entries come first so the app's `@/` does not swallow
 * them. Shared by the app build and the test run, which must agree.
 */
export const alias: Alias[] = [
  { find: /^@\/lib\/utils$/, replacement: uiSrc('lib/utils') },
  { find: /^@\/components\/ui\//, replacement: uiSrc('components/ui/') },
  { find: /^@\//, replacement: appSrc() },
];
