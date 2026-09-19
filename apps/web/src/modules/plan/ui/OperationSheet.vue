<script setup lang="ts">
/**
 * What the "+" opens (reference slide 13): one sheet, and a segment at the top
 * that says which of the three things is being written — a transfer, an
 * expense, an income source.
 *
 * The segment is the whole point of the pattern: picking the kind of operation
 * is part of writing it down, not a menu in front of it. That is what takes
 * «three taps before an expense can be written down» to one.
 *
 * Only one sheet is mounted at a time, so switching kind starts a clean form
 * rather than carrying a half-typed expense into a transfer, where none of its
 * fields mean anything.
 *
 * The Plan owns this because it is where the three modules already meet: it
 * composes them through their public barrels, and no data module has to learn
 * about its siblings' screens.
 */
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { ExpenseSheet } from '@/modules/expenses';
import { TransferSheet } from '@/modules/transfers';
import { routeComponent } from '@/shared/layout/route-fallback';

/**
 * Lazy, unlike its two neighbours: the income barrel is otherwise reached only
 * through routed screens, and a static import here would drag the whole module
 * into the entry chunk for a form most sessions never open. Wrapped like a
 * routed screen, so a chunk a deploy took away leaves a sentence and a Reload
 * button rather than an empty sheet.
 */
const IncomeSourceSheet = routeComponent(() =>
  import('@/modules/income').then((m) => m.IncomeSourceSheet),
);

const TYPES = ['transfer', 'expense', 'income'] as const;
type OperationType = (typeof TYPES)[number];

const props = withDefaults(defineProps<{ type?: OperationType }>(), { type: 'expense' });
const open = defineModel<boolean>('open', { default: false });

const { t } = useI18n();
const router = useRouter();
const type = ref<OperationType>(props.type);

const types = computed(() => TYPES.map((value) => ({ value, label: t(`quick.types.${value}`) })));
const isType = (v: string): v is OperationType => (TYPES as readonly string[]).includes(v);
function pick(value: string) {
  if (isType(value)) type.value = value;
}
/** A saved source has a screen of its own, and that is where it goes. */
function savedSource(id: string) {
  open.value = false;
  void router.push(`/plan/income/${id}`);
}
</script>

<template>
  <TransferSheet
    v-if="type === 'transfer'"
    v-model:open="open"
    :types="types"
    :type="type"
    @update:type="pick"
  >
    <template #secondary>
      <slot name="secondary" />
    </template>
  </TransferSheet>

  <ExpenseSheet
    v-else-if="type === 'expense'"
    :open="open"
    :types="types"
    :type="type"
    @update:open="open = $event"
    @update:type="pick"
    @done="open = false"
  >
    <template #secondary>
      <slot name="secondary" />
    </template>
  </ExpenseSheet>

  <IncomeSourceSheet
    v-else
    :open="open"
    :types="types"
    :type="type"
    @update:open="open = $event"
    @update:type="pick"
    @saved="savedSource"
  >
    <template #secondary>
      <slot name="secondary" />
    </template>
  </IncomeSourceSheet>
</template>
