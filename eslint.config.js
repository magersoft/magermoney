import tseslint from 'typescript-eslint';
import boundaries from 'eslint-plugin-boundaries';
import pluginVue from 'eslint-plugin-vue';
import vueTsEslintConfig from '@vue/eslint-config-typescript';

/**
 * The repository root. Every element pattern below is written relative to it,
 * so the rules fire the same whether eslint runs from the root or from inside a
 * workspace — which is what `turbo run lint` does.
 */
const ROOT = import.meta.dirname;

/** The shared packages every app may depend on. */
const PACKAGES = ['domain', 'contracts', 'ui', 'web-locales'];

/** v7 wants a full entity selector per allowed dependency. */
const allowed = (types) => types.map((type) => ({ to: { element: { type } } }));

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/.vercel/**',
      '**/coverage/**',
      '**/dev-dist/**',
    ],
  },
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  ...vueTsEslintConfig(),
  {
    plugins: { boundaries },
    settings: {
      'boundaries/root-path': ROOT,
      // A dependency has to be resolved to a file before it can be placed in an
      // element, and every cross-package import here goes through a workspace
      // name (`@magermoney/domain`) or the web alias (`@/…`).
      'import/resolver': {
        typescript: { alwaysTryTypes: true, project: [`${ROOT}/tsconfig.eslint.json`] },
      },
      // First match wins, so the narrow intra-app elements precede `web`.
      'boundaries/elements': [
        { type: 'web-locales', partialMatch: false, pattern: 'apps/web/src/locales/**' },
        { type: 'web-app', partialMatch: false, pattern: 'apps/web/src/app/**' },
        {
          type: 'web-module',
          partialMatch: false,
          pattern: 'apps/web/src/modules/*/**',
          capture: ['module'],
        },
        { type: 'web-shared', partialMatch: false, pattern: 'apps/web/src/shared/**' },
        { type: 'web', partialMatch: false, pattern: 'apps/web/**' },
        { type: 'api', partialMatch: false, pattern: 'apps/api/**' },
        { type: 'domain', partialMatch: false, pattern: 'packages/domain/**' },
        { type: 'contracts', partialMatch: false, pattern: 'packages/contracts/**' },
        { type: 'ui', partialMatch: false, pattern: 'packages/ui/**' },
        { type: 'config', partialMatch: false, pattern: 'packages/config/**' },
      ],
    },
    rules: {
      /**
       * The dependency direction of the whole repository, plus the one inside
       * `apps/web`: `shared` knows no feature, a module knows `shared` and its
       * siblings, and only `app` — the composition root — knows everything.
       */
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          policies: [
            { from: [{ element: { type: 'config' } }], allow: [] },
            { from: [{ element: { type: 'domain' } }], allow: [] },
            { from: [{ element: { type: 'ui' } }], allow: [] },
            { from: [{ element: { type: 'web-locales' } }], allow: [] },
            { from: [{ element: { type: 'contracts' } }], allow: allowed(['domain']) },
            { from: [{ element: { type: 'api' } }], allow: allowed(['domain', 'contracts']) },
            {
              from: [{ element: { type: 'web-shared' } }],
              allow: allowed([...PACKAGES, 'web-shared']),
            },
            {
              from: [{ element: { type: 'web-module' } }],
              allow: allowed([...PACKAGES, 'web-shared', 'web-module']),
            },
            {
              from: [{ element: { type: 'web-app' } }],
              allow: allowed([...PACKAGES, 'web-shared', 'web-module', 'web-app']),
            },
            {
              from: [{ element: { type: 'web' } }],
              allow: allowed([...PACKAGES, 'web', 'web-shared', 'web-module', 'web-app']),
            },
          ],
        },
      ],
    },
  },
  {
    /**
     * A module is its `index.ts`. Reaching past it couples two features through
     * a file neither owns. Expressed as a path rule rather than
     * `boundaries/entry-point` because a module's own files import each other
     * relatively, and only the alias crosses a module border.
     *
     * Tests are exempt: mocking a module's internals is how a unit test isolates
     * it.
     */
    files: ['apps/web/src/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/modules/*/*'],
              message: 'Import a module through its index.ts, not one of its files.',
            },
          ],
        },
      ],
    },
  },
  {
    // Prettier owns formatting; these `eslint-plugin-vue` rules only judge
    // layout (line breaks, indentation, attribute wrapping) and fight
    // `prettier --write` on every `lint-staged` run since it runs after
    // `eslint --fix`. Off everywhere, not just in generated components.
    rules: {
      'vue/max-attributes-per-line': 'off',
      'vue/html-indent': 'off',
      'vue/html-closing-bracket-newline': 'off',
      'vue/html-self-closing': 'off',
    },
  },
  {
    // Generated by the shadcn-vue CLI. Re-running `add` would revert any edit
    // made to satisfy these, so they are not enforced here.
    files: ['packages/ui/src/components/ui/**'],
    rules: {
      'vue/multi-word-component-names': 'off',
      'vue/require-default-prop': 'off',
    },
  },
);
