// @vitest-environment node
// Reads the stylesheet rather than mounting anything; see tokens-contrast.test.ts.
import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { describe, expect, it } from 'vitest';

const entry = readFileSync(
  fileURLToPath(new URL('../src/styles/index.css', import.meta.url)),
  'utf8',
);

describe('@magermoney/ui/styles', () => {
  /*
   * vue-sonner injects no styles of its own. Miss its stylesheet and nothing
   * breaks loudly: every toast simply renders as a plain list at the end of
   * the document, below the whole page, and the app looks like it is printing
   * its errors at the bottom of the screen. A missing import is invisible in
   * review, so it is asserted here.
   */
  it('carries the toast stylesheet, which the package does not inject itself', () => {
    expect(entry).toContain("@import 'vue-sonner/style.css'");
  });
});
