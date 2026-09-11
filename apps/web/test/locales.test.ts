import { describe, expect, it } from 'vitest';
import { createI18n } from 'vue-i18n';
import en from '../src/locales/en.json';
import ru from '../src/locales/ru.json';

/**
 * A leaf key is any string value reachable by dot-path. vue-i18n compiles
 * each message lazily, on first `t()` call, so only actually calling every
 * key catches a bad message (a bare `@`, an unmatched `{`) before a screen
 * does.
 */
function leafKeys(node: unknown, prefix = ''): string[] {
  if (typeof node === 'string') return [prefix];
  if (node && typeof node === 'object') {
    return Object.entries(node as Record<string, unknown>).flatMap(([key, value]) =>
      leafKeys(value, prefix ? `${prefix}.${key}` : key),
    );
  }
  return [];
}

describe('locale messages', () => {
  it('compiles every key in both locales without a linked-message or interpolation error', () => {
    const i18n = createI18n({
      legacy: false,
      locale: 'en',
      fallbackLocale: 'en',
      messages: { ru, en },
    });
    const { t } = i18n.global;

    const failures: string[] = [];
    for (const [locale, messages] of Object.entries({ ru, en })) {
      for (const key of leafKeys(messages)) {
        try {
          // @ts-expect-error dynamic key
          t(key, {}, { locale });
        } catch (e) {
          failures.push(`${locale}:${key} — ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    }

    expect(failures).toEqual([]);
  });

  it('keeps ru and en in parity: every key in one exists in the other', () => {
    const ruKeys = leafKeys(ru).sort();
    const enKeys = leafKeys(en).sort();

    expect(ruKeys).toEqual(enKeys);
  });
});
