<script setup lang="ts">
/**
 * One owned thing. An asset is not a movement and not a balance: it is a number
 * somebody decided on, on a day — so the date is printed beside the value at
 * equal weight, and an asset nobody has valued yet says so rather than showing
 * a zero it has no grounds for.
 *
 * Whether it counts towards the capital is the other fact worth seeing from the
 * list, because it is the only one that changes a number on another screen.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { AmountLockup, MarkDisc, type AmountLocale } from '@magermoney/ui';
import type { Asset } from '@magermoney/domain';
import { formatDay, type DateLocale } from '@/shared/dates/format';

const props = defineProps<{ asset: Asset }>();

const { t, locale } = useI18n();
const amountLocale = computed(() => locale.value as AmountLocale);
const uiLocale = computed(() => locale.value as DateLocale);
const valuedLabel = computed(() =>
  props.asset.valuedOn
    ? t('assets.valuedOn', { date: formatDay(props.asset.valuedOn, uiLocale.value) })
    : t('assets.neverValued'),
);
</script>

<template>
  <div
    class="flex min-h-11 items-center justify-between gap-3 px-4 py-3"
    :data-testid="`asset-row-${asset.id}`"
  >
    <div class="flex min-w-0 items-center gap-3">
      <MarkDisc
        :emoji="asset.icon"
        :color="asset.color"
        :name="asset.name"
        class="size-9 text-sm"
      />
      <div class="flex min-w-0 flex-col gap-0.5">
        <span class="truncate text-sm font-medium">{{ asset.name }}</span>
        <span class="text-muted-foreground text-xs">
          {{ valuedLabel }}
          <template v-if="!asset.countsInTotal"> · {{ t('assets.notCounted') }}</template>
        </span>
      </div>
    </div>
    <AmountLockup
      v-if="asset.value"
      :amount="asset.value.toString()"
      :code="asset.value.currency.code"
      :scale="asset.value.currency.scale"
      :locale="amountLocale"
      class="shrink-0 text-base"
    />
    <span v-else class="text-muted-foreground shrink-0 text-sm">—</span>
  </div>
</template>
