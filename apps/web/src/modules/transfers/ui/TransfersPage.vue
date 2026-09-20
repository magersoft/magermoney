<script setup lang="ts">
/** Every transfer, newest first; tap one to change or remove it while it still can be. */
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import type { TransferDto } from '@magermoney/contracts';
import { Skeleton } from '@magermoney/ui';
import { useAccounts } from '@/modules/accounts';
import { formatDateTime } from '@/shared/dates/format';
import { usePageTitle } from '@/shared/layout/page-bar';
import { useTransfers } from '../application/use-transfers';
import TransferSheet from './TransferSheet.vue';

const route = useRoute();
const { t, locale } = useI18n();
const accountId = computed(() =>
  typeof route.query.accountId === 'string' ? route.query.accountId : undefined,
);
const { transfers, isLoading } = useTransfers(accountId);
const { accounts } = useAccounts();
const nameOf = (id: string) => accounts.value.find((a) => a.id === id)?.name ?? '?';
const currencyOf = (id: string) => accounts.value.find((a) => a.id === id)?.currency ?? '';
const open = ref(false);
const editing = ref<TransferDto | undefined>();

usePageTitle(() => t('transfers.title'));
function edit(tr: TransferDto) {
  editing.value = tr;
  open.value = true;
}
</script>

<template>
  <section class="pb-8">
    <!-- The bar carries this on a phone; a wide window's bar carries the links. -->
    <h1 class="sr-only text-2xl font-semibold tracking-[-0.01em] md:not-sr-only">
      {{ t('transfers.title') }}
    </h1>
    <Skeleton v-if="isLoading" class="mt-4 h-12 w-full" />
    <p v-else-if="transfers.length === 0" class="mt-4 text-sm text-muted-foreground">
      {{ t('transfers.empty') }}
    </p>
    <ul v-else class="mt-4 divide-y divide-border/60">
      <li v-for="tr in transfers" :key="tr.id">
        <button
          type="button"
          class="flex min-h-9 w-full items-center gap-3 py-3 text-left pointer-coarse:min-h-11"
          :data-testid="`transfer-${tr.id}`"
          @click="edit(tr)"
        >
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm">{{
              t('transfers.row', { from: nameOf(tr.fromAccountId), to: nameOf(tr.toAccountId) })
            }}</span>
            <span class="block text-xs text-muted-foreground"
              >{{ formatDateTime(tr.occurredAt, locale as 'ru' | 'en')
              }}<template v-if="tr.note"> · {{ tr.note }}</template></span
            >
          </span>
          <span class="text-right">
            <span class="block font-mono text-[15px] tabular-nums"
              >−{{ tr.amountSent }} {{ currencyOf(tr.fromAccountId) }}</span
            >
            <span class="block font-mono text-xs tabular-nums text-muted-foreground"
              >+{{ tr.amountReceived }} {{ currencyOf(tr.toAccountId) }}</span
            >
          </span>
        </button>
      </li>
    </ul>
    <TransferSheet v-model:open="open" :transfer="editing" />
  </section>
</template>
