<script setup lang="ts">
/** The journal, newest first, each row with how much it moved since the entry before it. */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { BalanceEntryDto } from '@magermoney/contracts';
import { Decimal } from '@magermoney/domain';
import { Badge } from '@magermoney/ui';
import { formatDateTime } from '@/shared/dates/format';

const { entries, scale } = defineProps<{
  entries: BalanceEntryDto[];
  currency: string;
  /** Fraction digits of the account's currency: a bare `toFixed()` writes 0.00000002 as 0.00000002 on one row and 0.5 on the next. */
  scale: number;
  editableId: string | null;
}>();
const emit = defineEmits<{ edit: [entry: BalanceEntryDto] }>();
const { t, locale } = useI18n();

const rows = computed(() =>
  entries.map((e, i) => {
    const prev = entries[i + 1];
    const delta = prev ? new Decimal(e.amount).minus(prev.amount) : null;
    return {
      e,
      delta:
        delta && !delta.isZero() ? `${delta.isPositive() ? '+' : ''}${delta.toFixed(scale)}` : null,
    };
  }),
);
</script>

<template>
  <ul class="divide-y divide-border/60">
    <li v-for="{ e, delta } in rows" :key="e.id">
      <button
        type="button"
        class="flex min-h-9 w-full items-center gap-3 py-3 text-left disabled:cursor-default pointer-coarse:min-h-11"
        :disabled="e.id !== editableId"
        :data-testid="`balance-entry-${e.id}`"
        @click="emit('edit', e)"
      >
        <span class="min-w-0 flex-1">
          <span class="block text-sm">{{
            formatDateTime(e.recordedAt, locale as 'ru' | 'en')
          }}</span>
          <span v-if="e.note" class="block truncate text-xs text-muted-foreground">{{
            e.note
          }}</span>
        </span>
        <Badge v-if="e.origin === 'transfer'" variant="secondary">
          {{ t('accounts.detail.byTransfer') }}
        </Badge>
        <span class="text-right">
          <span class="block font-mono text-[15px] tabular-nums"
            >{{ e.amount }} {{ currency }}</span
          >
          <span v-if="delta" class="block font-mono text-xs tabular-nums text-muted-foreground"
            >{{ delta }} {{ t('accounts.detail.sinceLast') }}</span
          >
        </span>
      </button>
    </li>
  </ul>
</template>
