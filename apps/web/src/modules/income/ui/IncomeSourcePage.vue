<script setup lang="ts">
/** One source: what it brings, when it pays, and every receipt that actually came from it. */
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import type { InflowDto } from '@magermoney/contracts';
import { netMonthly } from '@magermoney/domain';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Skeleton,
  useToast,
} from '@magermoney/ui';
import { useAccounts } from '@/modules/accounts';
import { useCurrencyRegistry } from '@/modules/currencies';
import { MoneyText, todayIso } from '@/modules/rates';
import { errorKeyFor } from '@/shared/api/error-messages';
import { usePageAction, usePageTitle } from '@/shared/layout/page-bar';
import { formatDay, type DateLocale } from '@/shared/dates/format';
import { payDaysLabel } from '../domain/labels';
import { toIncomeSource } from '../domain/mappers';
import { useIncomeSource, useIncomeSources } from '../application/use-income-sources';
import {
  useDeleteIncomeSource,
  useUpdateIncomeSource,
} from '../application/use-income-source-mutations';
import { useInflows } from '../application/use-inflows';
import InflowRow from './InflowRow.vue';
import InflowSheet from './InflowSheet.vue';

const route = useRoute();
const router = useRouter();
const { t, locale } = useI18n();
const { toast } = useToast();
const id = computed(() => String(route.params.id));
const dto = useIncomeSource(id);
const { isLoading, isError } = useIncomeSources();
const registry = useCurrencyRegistry();
const { accounts } = useAccounts();
const { dtos: inflows, isLoading: inflowsLoading } = useInflows(() => ({ sourceId: id.value }));
const { update, isPending: ending } = useUpdateIncomeSource();
const { remove, isPending: removing } = useDeleteIncomeSource();

const uiLocale = computed(() => locale.value as DateLocale);
const source = computed(() => (dto.value ? toIncomeSource(dto.value, registry.value) : undefined));

usePageTitle(() => dto.value?.name ?? null);
/*
 * Writing down money that arrived is what this screen is opened for, so it is
 * the bar's action rather than the first of four buttons in a row. The three
 * that are left are rarer or destructive, and they moved into the ⋯ menu —
 * the same place the account screen keeps its own.
 */
usePageAction(() =>
  dto.value
    ? {
        label: t('action.record'),
        ariaLabel: t('inflows.record'),
        onSelect: () => openSheet(),
        testid: 'source-record-inflow',
      }
    : null,
);
const net = computed(() => (source.value ? netMonthly(source.value) : undefined));
const netText = computed(() => net.value?.amount.toFixed(net.value.currency.scale) ?? '');
const days = computed(() => payDaysLabel(dto.value?.payDays ?? []));
const isCurrent = computed(() => dto.value?.activeTo == null || dto.value.activeTo >= todayIso());
const accountName = (accountId: string | null) =>
  accounts.value.find((a) => a.id === accountId)?.name;
const confirmDelete = ref(false);
const sheetOpen = ref(false);
const editing = ref<InflowDto | undefined>();
function openSheet(inflow?: InflowDto) {
  editing.value = inflow;
  sheetOpen.value = true;
}

async function end() {
  if (!dto.value) return;
  try {
    await update(dto.value.id, { activeTo: todayIso() });
  } catch (e) {
    toast(t(errorKeyFor(e, 'income.source.failed')));
  }
}
async function del() {
  if (!dto.value) return;
  try {
    await remove(dto.value.id);
    await router.replace({ path: '/plan', query: { tab: 'income' } });
  } catch (e) {
    toast(t(errorKeyFor(e, 'income.source.failed')));
  }
}
</script>

<template>
  <section v-if="dto && source && net" class="pb-8">
    <header>
      <div class="flex items-center gap-2">
        <!-- The bar carries this on a phone; a wide window's bar carries the links. -->
        <h1
          class="sr-only truncate text-2xl font-semibold tracking-[-0.01em] md:not-sr-only"
          data-testid="source-title"
        >
          {{ dto.name }}
        </h1>
        <Badge v-if="dto.isPrimary" variant="secondary">
          {{ t('income.primary') }}
        </Badge>
      </div>
      <p
        class="mt-4 text-[32px] font-semibold leading-[1.1] tabular-nums"
        data-testid="source-net-monthly"
      >
        {{ netText }}
        <span class="font-mono text-[0.6em] uppercase tracking-[0.08em] text-muted-foreground">{{
          net.currency.code
        }}</span>
      </p>
      <p class="text-sm text-muted-foreground">
        {{ t('income.perMonth') }} ·
        <MoneyText :amount="net.toString()" :currency="net.currency.code" />
      </p>
      <p class="mt-3 text-sm text-muted-foreground">
        {{ t('income.gross', { amount: `${dto.grossAmount} ${dto.currency}` }) }}
      </p>
      <p class="text-sm text-muted-foreground">
        {{ days ? t('income.payDays', { days }) : t('income.irregular') }}
      </p>
      <p class="text-sm text-muted-foreground">
        {{
          dto.activeTo
            ? t('income.periodEnded', {
                from: formatDay(dto.activeFrom, uiLocale),
                to: formatDay(dto.activeTo, uiLocale),
              })
            : t('income.period', { from: formatDay(dto.activeFrom, uiLocale) })
        }}
      </p>
    </header>

    <!--
      What is left after the bar took "Record": rarer, and one of them
      destructive, so they sit quietly under the figures rather than competing
      with them.
    -->
    <div class="mt-6 flex flex-wrap gap-2">
      <Button
        variant="outline"
        class="min-h-9 pointer-coarse:min-h-11"
        data-testid="source-edit"
        @click="router.push(`/plan/income/${dto.id}/edit`)"
      >
        {{ t('income.source.edit') }}
      </Button>
      <Button
        v-if="isCurrent"
        variant="outline"
        class="min-h-9 pointer-coarse:min-h-11"
        :disabled="ending"
        data-testid="source-end"
        @click="end"
      >
        {{ t('income.source.end') }}
      </Button>
      <Button
        variant="ghost"
        class="min-h-9 text-destructive pointer-coarse:min-h-11"
        data-testid="source-delete"
        @click="confirmDelete = true"
      >
        {{ t('income.source.delete') }}
      </Button>
    </div>

    <h2 class="mt-8 font-mono text-xs uppercase tracking-[0.08em] text-muted-foreground">
      {{ t('income.source.inflows') }}
    </h2>
    <Skeleton v-if="inflowsLoading" class="mt-2 h-14 w-full" />
    <p v-else-if="inflows.length === 0" class="mt-2 text-sm text-muted-foreground">
      {{ t('income.source.noInflows') }}
    </p>
    <ul v-else class="mt-1 divide-y divide-border/60 border-t border-border">
      <li v-for="i in inflows" :key="i.id">
        <InflowRow :inflow="i" :account-name="accountName(i.accountId)" @select="openSheet" />
      </li>
    </ul>

    <InflowSheet v-model:open="sheetOpen" :source-id="dto.id" :inflow="editing" />

    <AlertDialog v-model:open="confirmDelete">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{ t('income.source.deleteTitle') }}</AlertDialogTitle>
          <AlertDialogDescription>{{ t('income.source.deleteBody') }}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{{ t('income.source.cancel') }}</AlertDialogCancel>
          <AlertDialogAction :disabled="removing" data-testid="source-delete-confirm" @click="del">
            {{ t('income.source.delete') }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </section>
  <div v-else-if="isLoading" class="space-y-4">
    <Skeleton class="h-8 w-40" />
    <Skeleton class="h-12 w-64" />
  </div>
  <!-- The list answered and this id is not in it: a stale link, or the source was just deleted. -->
  <div v-else class="mt-10 text-center">
    <p class="text-sm text-muted-foreground">
      {{ isError ? t('income.source.failed') : t('income.source.notFound') }}
    </p>
    <Button as-child variant="outline" class="mt-4 min-h-9 pointer-coarse:min-h-11">
      <RouterLink :to="{ path: '/plan', query: { tab: 'income' } }" data-testid="source-back">
        {{ t('income.title') }}
      </RouterLink>
    </Button>
  </div>
</template>
