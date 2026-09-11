import tseslint from 'typescript-eslint';
import boundaries from 'eslint-plugin-boundaries';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '**/.vercel/**', '**/coverage/**'] },
  ...tseslint.configs.recommended,
  {
    plugins: { boundaries },
    settings: {
      'boundaries/elements': [
        { type: 'domain', pattern: 'packages/domain/**' },
        { type: 'contracts', pattern: 'packages/contracts/**' },
        { type: 'ui', pattern: 'packages/ui/**' },
        { type: 'api', pattern: 'apps/api/**' },
        { type: 'web', pattern: 'apps/web/**' },
      ],
    },
    rules: {
      'boundaries/element-types': ['error', {
        default: 'disallow',
        rules: [
          { from: 'domain', allow: [] },
          { from: 'contracts', allow: ['domain'] },
          { from: 'ui', allow: [] },
          { from: 'api', allow: ['domain', 'contracts'] },
          { from: 'web', allow: ['domain', 'contracts', 'ui'] },
        ],
      }],
    },
  },
);
