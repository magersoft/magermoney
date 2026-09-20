// @vitest-environment node
// Reads the component's source rather than mounting it: under happy-dom
// `import.meta.url` is served over http and the lookup cannot resolve.
import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  fileURLToPath(new URL('../src/shared/layout/BottomNav.vue', import.meta.url)),
  'utf8',
);

describe("the bottom navigation's material", () => {
  /*
   * The glass is a design-system material, not a look this screen arranges for
   * itself. A colour or a blur radius written here would be a value that
   * cannot be retuned with the rest of the palette — and, worse, cannot be
   * re-proved with it: the panel's alpha is what its labels are read against,
   * and that proof lives beside the tokens in `packages/ui`.
   */
  it('spells out no colour and no blur of its own', () => {
    expect(source).not.toMatch(/oklch\(|rgba?\(|#[0-9a-fA-F]{3,8}\b|backdrop-blur|blur\(/);
  });

  it('asks for the material by name', () => {
    expect(source).toContain('glass-panel');
  });
});
