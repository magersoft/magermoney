<script setup lang="ts">
/**
 * Money that arrived. The source decides the currency; an Account is optional,
 * and when its currency differs the person types what actually reached it — the
 * app never converts a balance by itself (ADR 0002). The day's rate is a hint,
 * the realised rate is derived once both numbers are in.
 */
import { computed, nextTick, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Motion } from 'motion-v';
import type { InflowDto } from '@magermoney/contracts';
import { Decimal, Money, deriveInflowCredit, type Currency } from '@magermoney/domain';
import {
  Button,
  fade,
  Input,
  MoneyInput,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  useToast,
} from '@magermoney/ui';
import { useAccounts } from '@/modules/accounts';
import { useCurrencies, useCurrencyRegistry } from '@/modules/currencies';
import { todayIso, useRates } from '@/modules/rates';
import { errorKeyFor } from '@/shared/api/error-messages';
import type { DateLocale } from '@/shared/dates/format';
import { useIncomeSources } from '../application/use-income-sources';
import { useCreateIncomeSource } from '../application/use-income-source-mutations';
import {
  useCreateInflow,
  useDeleteInflow,
  useUpdateInflow,
} from '../application/use-inflow-mutations';

const props = defineProps<{ open: boolean; sourceId?: string; inflow?: InflowDto }>();
const emit = defineEmits<{ 'update:open': [open: boolean] }>();

const NEW_SOURCE = '__new__';
const NO_ACCOUNT = '';
const { t, locale } = useI18n();
const uiLocale = computed(() => locale.value as DateLocale);
const { toast } = useToast();
const { dtos: sources } = useIncomeSources();
const { accounts } = useAccounts();
const currencies = useCurrencies();
const registry = useCurrencyRegistry();
const rates = useRates();
const { create, isPending: creating } = useCreateInflow();
const { update, isPending: updating } = useUpdateInflow();
const { remove } = useDeleteInflow();
const { create: createSource, isPending: creatingSource } = useCreateIncomeSource();

const source = ref('');
const newName = ref('');
const newCurrency = ref('USD');
const amount = ref('');
const receivedOn = ref(todayIso());
/** The server's "today" is the truth for an untouched date; the field's default is only what the person sees. */
const dateTouched = ref(false);
const accountId = ref(NO_ACCOUNT);
const credited = ref('');
const usdRate = ref('');
const more = ref(false);
const note = ref('');

const today = todayIso();
const currentSources = computed(() =>
  sources.value.filter(
    (s) => s.activeTo === null || s.activeTo >= today || s.id === props.inflow?.incomeSourceId,
  ),
);
const activeAccounts = computed(() =>
  accounts.value.filter((a) => a.archivedAt === null || a.id === props.inflow?.accountId),
);
const chosenSource = computed(() => sources.value.find((s) => s.id === source.value));

/**
 * True for the tick in which `reset()` fills the fields, so the guard below
 * does not mistake a prefill for the person changing their mind.
 */
let priming = false;

function reset() {
  priming = true;
  void nextTick(() => (priming = false));
  const i = props.inflow;
  source.value = i?.incomeSourceId ?? props.sourceId ?? currentSources.value[0]?.id ?? NEW_SOURCE;
  newName.value = '';
  amount.value = i?.amount ?? '';
  receivedOn.value = i?.receivedOn ?? todayIso();
  dateTouched.value = false;
  accountId.value = i
    ? (i.accountId ?? NO_ACCOUNT)
    : (chosenSource.value?.defaultAccountId ?? NO_ACCOUNT);
  credited.value = i?.creditedAmount ?? '';
  usdRate.value = i?.realisedRateToUsd ?? '';
  more.value = Boolean(i?.realisedRateToUsd || i?.note);
  note.value = i?.note ?? '';
}
watch(
  () => props.open,
  (open) => {
    if (open) reset();
  },
  { immediate: true },
);
/** The sheet can open before the lists arrive; the defaults are re-read once, as long as nothing was typed. */
watch([sources, accounts], () => {
  if (props.open && amount.value === '' && !props.inflow) reset();
});
/** Choosing another source moves the account to that source's usual one. */
watch(source, (id, before) => {
  if (!before || props.inflow) return;
  accountId.value = sources.value.find((s) => s.id === id)?.defaultAccountId ?? NO_ACCOUNT;
});

const isNew = computed(() => source.value === NEW_SOURCE);
const currencyCode = computed(() =>
  isNew.value ? newCurrency.value : (props.inflow?.currency ?? chosenSource.value?.currency ?? ''),
);
const account = computed(() => accounts.value.find((a) => a.id === accountId.value));
/**
 * A credited amount is typed in one account's currency, for one source's
 * currency. Changing either would otherwise send a number typed for euros as
 * pounds, so the field is emptied and Save waits for it to be typed again.
 */
watch([accountId, currencyCode], () => {
  if (priming) return;
  credited.value = '';
});

const cross = computed(() =>
  Boolean(account.value && account.value.currency !== currencyCode.value),
);
const scaleOf = (code: string | undefined) =>
  currencies.value.find((c) => c.code === code)?.scale ?? 2;
const currencyOf = (code: string): Currency =>
  registry.value.get(code).unwrapOr({ code, kind: 'fiat', scale: scaleOf(code) });

const hint = computed(() => {
  if (!cross.value || !account.value || amount.value === '' || !rates.table.value) return null;
  return rates.table.value
    .convert(Money.of(amount.value, currencyOf(currencyCode.value)), account.value.currency)
    .match(
      (m) => m.round().toString(),
      () => null,
    );
});
const realised = computed(() => {
  if (!cross.value || !account.value || amount.value === '' || credited.value === '') return null;
  const accountCurrency = currencyOf(account.value.currency);
  return deriveInflowCredit({
    amount: Money.of(amount.value, currencyOf(currencyCode.value)),
    accountCurrency,
    creditedAmount: Money.of(credited.value, accountCurrency),
  }).match(
    (d) => d.realisedRate?.toFixed() ?? null,
    () => null,
  );
});
const busy = computed(() => creating.value || updating.value || creatingSource.value);
const canSubmit = computed(
  () =>
    amount.value !== '' &&
    new Decimal(amount.value).gt(0) &&
    (isNew.value ? newName.value.trim() !== '' : source.value !== '') &&
    (!cross.value || credited.value !== ''),
);

async function resolveSourceId(): Promise<string> {
  if (!isNew.value) return source.value;
  // A source born from a receipt expects nothing: no gross, no schedule. It is
  // irregular until the person says otherwise, and it starts the day the money came.
  const created = await createSource({
    name: newName.value.trim(),
    grossAmount: '0',
    currency: newCurrency.value,
    taxRate: '0',
    commissionRate: '0',
    payDays: [],
    isPrimary: false,
    activeFrom: receivedOn.value,
  });
  return created.id;
}

async function submit() {
  if (!canSubmit.value) return;
  try {
    const credit = account.value
      ? { accountId: account.value.id, ...(cross.value ? { creditedAmount: credited.value } : {}) }
      : {};
    const rate = usdRate.value === '' ? {} : { realisedRateToUsd: usdRate.value };
    const noteValue = note.value.trim() || null;
    let parked = false;
    if (props.inflow) {
      const before = props.inflow.accountId;
      await update(
        props.inflow.id,
        {
          amount: amount.value,
          ...(dateTouched.value ? { receivedOn: receivedOn.value } : {}),
          // `null` removes the credit; an unchanged account is sent again so a new amount re-applies to it.
          ...(account.value ? credit : { accountId: null }),
          realisedRateToUsd: usdRate.value === '' ? null : usdRate.value,
          note: noteValue,
        },
        [before, account.value?.id].filter((x): x is string => Boolean(x)),
      );
    } else {
      const incomeSourceId = await resolveSourceId();
      parked =
        (await create({
          incomeSourceId,
          amount: amount.value,
          ...(dateTouched.value ? { receivedOn: receivedOn.value } : {}),
          ...credit,
          ...rate,
          note: noteValue,
        })) === 'parked';
    }
    emit('update:open', false);
    if (parked) toast(t('offline.saved'));
  } catch (e) {
    toast(t(errorKeyFor(e, 'inflows.failed')));
  }
}

async function del() {
  if (!props.inflow) return;
  try {
    await remove(props.inflow.id, props.inflow.accountId ? [props.inflow.accountId] : []);
    emit('update:open', false);
  } catch (e) {
    toast(t(errorKeyFor(e, 'inflows.failed')));
  }
}
</script>

<template>
  <Sheet :open="open" @update:open="emit('update:open', $event)">
    <SheetContent
      side="bottom"
      class="max-h-[92dvh] overflow-y-auto rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]"
    >
      <SheetHeader>
        <SheetTitle>{{ inflow ? t('inflows.editTitle') : t('inflows.title') }}</SheetTitle>
      </SheetHeader>
      <form class="mt-4 space-y-4" @submit.prevent="submit">
        <label class="block">
          <span class="text-xs font-medium text-muted-foreground">{{ t('inflows.source') }}</span>
          <select
            v-model="source"
            data-testid="inflow-source"
            :disabled="Boolean(inflow)"
            class="mt-1 flex min-h-9 w-full rounded-lg border border-border bg-background px-3 text-sm pointer-coarse:min-h-11"
          >
            <option v-for="s in currentSources" :key="s.id" :value="s.id">
              {{ s.name }} · {{ s.currency }}
            </option>
            <option v-if="!inflow" :value="NEW_SOURCE">{{ t('inflows.newSource') }}</option>
          </select>
        </label>

        <div v-if="isNew" class="grid grid-cols-[1fr_7rem] gap-3">
          <label class="block">
            <span class="text-xs font-medium text-muted-foreground">{{
              t('inflows.newName')
            }}</span>
            <Input v-model="newName" maxlength="80" data-testid="inflow-new-name" class="mt-1" />
          </label>
          <label class="block">
            <span class="text-xs font-medium text-muted-foreground">{{
              t('inflows.newCurrency')
            }}</span>
            <select
              v-model="newCurrency"
              data-testid="inflow-new-currency"
              class="mt-1 flex min-h-9 w-full rounded-lg border border-border bg-background px-3 text-sm pointer-coarse:min-h-11"
            >
              <option v-for="c in currencies" :key="c.code" :value="c.code">{{ c.code }}</option>
            </select>
          </label>
        </div>

        <label class="block">
          <span class="text-xs font-medium text-muted-foreground"
            >{{ t('inflows.amount') }} · {{ currencyCode }}</span
          >
          <MoneyInput
            v-model="amount"
            data-testid="inflow-amount"
            :scale="scaleOf(currencyCode)"
            :locale="uiLocale"
            class="mt-1"
            autofocus
          />
        </label>

        <label class="block">
          <span class="text-xs font-medium text-muted-foreground">{{ t('inflows.date') }}</span>
          <Input
            v-model="receivedOn"
            type="date"
            :max="today"
            class="mt-1"
            data-testid="inflow-date"
            @change="dateTouched = true"
          />
        </label>

        <label class="block">
          <span class="text-xs font-medium text-muted-foreground">{{ t('inflows.account') }}</span>
          <select
            v-model="accountId"
            data-testid="inflow-account"
            class="mt-1 flex min-h-9 w-full rounded-lg border border-border bg-background px-3 text-sm pointer-coarse:min-h-11"
          >
            <option :value="NO_ACCOUNT">{{ t('inflows.noAccount') }}</option>
            <option v-for="a in activeAccounts" :key="a.id" :value="a.id">
              {{ a.name }} · {{ a.balance ?? '0' }} {{ a.currency }}
            </option>
          </select>
        </label>

        <Motion v-if="cross" tag="label" class="block" v-bind="fade">
          <span class="text-xs font-medium text-muted-foreground"
            >{{ t('inflows.credited') }} · {{ account?.currency }}</span
          >
          <MoneyInput
            v-model="credited"
            data-testid="inflow-credited"
            :scale="scaleOf(account?.currency)"
            :locale="uiLocale"
            class="mt-1"
          />
          <span
            v-if="hint"
            data-testid="inflow-hint"
            class="mt-1 block text-xs text-muted-foreground"
          >
            {{ t('inflows.hint', { amount: `${hint} ${account?.currency}` }) }}
          </span>
          <span
            v-if="realised"
            data-testid="inflow-rate"
            class="mt-1 block text-xs text-muted-foreground"
          >
            {{ t('inflows.rate', { from: currencyCode, to: account?.currency, rate: realised }) }}
          </span>
        </Motion>

        <div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            class="min-h-9 pointer-coarse:min-h-11"
            :aria-expanded="more"
            aria-controls="inflow-more-fields"
            data-testid="inflow-more"
            @click="more = !more"
          >
            {{ t('inflows.more') }}
          </Button>
          <!-- `v-show`, not `v-if`: the button's `aria-controls` has to point at an element that exists. -->
          <div v-show="more" id="inflow-more-fields" class="mt-2 space-y-4">
            <label class="block">
              <span class="text-xs font-medium text-muted-foreground">{{
                t('inflows.usdRate')
              }}</span>
              <MoneyInput
                v-model="usdRate"
                data-testid="inflow-usd-rate"
                :scale="10"
                :locale="uiLocale"
                class="mt-1 h-11 text-base"
              />
              <span class="mt-1 block text-xs text-muted-foreground">{{
                t('inflows.usdRateHint', { code: currencyCode })
              }}</span>
            </label>
            <label class="block">
              <span class="text-xs font-medium text-muted-foreground">{{ t('inflows.note') }}</span>
              <Input v-model="note" maxlength="1000" class="mt-1" />
            </label>
          </div>
        </div>

        <div class="flex gap-2">
          <Button
            type="submit"
            size="lg"
            class="min-h-9 flex-1 pointer-coarse:min-h-11"
            :disabled="!canSubmit || busy"
            data-testid="inflow-save"
          >
            {{ inflow ? t('inflows.update') : t('inflows.save') }}
          </Button>
          <Button
            v-if="inflow"
            type="button"
            size="lg"
            variant="destructive"
            class="min-h-9 pointer-coarse:min-h-11"
            data-testid="inflow-delete"
            @click="del"
          >
            {{ t('inflows.delete') }}
          </Button>
        </div>
      </form>
    </SheetContent>
  </Sheet>
</template>
