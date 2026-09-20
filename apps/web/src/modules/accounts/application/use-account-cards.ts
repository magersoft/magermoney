import { computed, type ComputedRef } from 'vue';
import { useI18n } from 'vue-i18n';
import type { AccountCardItem } from '@magermoney/ui';
import { useCurrencies } from '@/modules/currencies';
import { toCardItem } from '../domain/account-card';
import { useAccounts } from './use-accounts';

/**
 * Every account's card, by id.
 *
 * The screens that draw cards have already decided the *order* — the Accounts
 * stack and the Home strip both read it from the capital summary, which groups
 * and sorts. What they have in hand there is the domain `Account`, which
 * deliberately carries nothing decorative: the colour, the scheme and the last
 * digits live on the DTO. So the order comes from one place and the card's
 * contents from another, and this is the other one.
 *
 * A map rather than a list, so a screen keeps its own order and looks each card
 * up as it goes. It reads the same query the screens already observe, so this
 * costs no request.
 */
export function useAccountCards(): ComputedRef<Map<string, AccountCardItem>> {
  const { accounts } = useAccounts();
  const currencies = useCurrencies();
  const { t } = useI18n();
  return computed(() => {
    const labels = { pinned: t('accounts.pinned') };
    return new Map(
      accounts.value.map((dto) => {
        const currency = currencies.value.find((c) => c.code === dto.currency);
        /* An unknown currency still gets a card: scale 2, fiat, same as the balance mapper. */
        return [
          dto.id,
          toCardItem(dto, { kind: currency?.kind ?? 'fiat', scale: currency?.scale ?? 2 }, labels),
        ] as const;
      }),
    );
  });
}
