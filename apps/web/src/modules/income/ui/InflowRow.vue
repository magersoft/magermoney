<script setup lang="ts">
/** One receipt: when, how much in its own currency, and where it landed if it was credited. */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { InflowDto } from '@magermoney/contracts';
import { MoneyText } from '@/modules/rates';
import { formatDay, type DateLocale } from '@/shared/dates/format';

const props = defineProps<{ inflow: InflowDto; accountName?: string }>();
const emit = defineEmits<{ select: [inflow: InflowDto] }>();
const { t, locale } = useI18n();
const date = computed(() => formatDay(props.inflow.receivedOn, locale.value as DateLocale));
</script>

<template>
  <button
    type="button"
    :data-testid="`inflow-row-${inflow.id}`"
    class="flex min-h-14 w-full items-center gap-3 py-2 text-left outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring"
    @click="emit('select', inflow)"
  >
    <span class="min-w-0 flex-1">
      <span class="block font-mono text-xs uppercase tracking-[0.08em] text-muted-foreground">{{
        date
      }}</span>
      <span v-if="accountName" class="block truncate text-xs text-muted-foreground">
        {{ t('income.inflow.credited', { account: accountName }) }}
      </span>
      <span v-if="inflow.note" class="block truncate text-xs text-muted-foreground">{{
        inflow.note
      }}</span>
    </span>
    <span class="text-right">
      <span class="block font-mono text-[15px] tabular-nums"
        >{{ inflow.amount }} {{ inflow.currency }}</span
      >
      <MoneyText
        class="text-xs text-muted-foreground"
        :amount="inflow.amount"
        :currency="inflow.currency"
      />
    </span>
  </button>
</template>
