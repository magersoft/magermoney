<script setup lang="ts">
/**
 * Which currency an amount is in, picked by typing rather than by recognising
 * a three-letter code in a native select.
 *
 * Two shapes, one popup. `row` is a form field in the language of `FieldRow`
 * — the surface, the 56px height, the label above the value — for a screen
 * where the currency is its own question. `compact` is the narrow trigger that
 * stands beside an amount: a mark and a code, sized to stay subordinate to the
 * number it qualifies, because the number is what is being entered and the
 * currency is usually already right.
 *
 * The popup is reka-ui's combobox, so roles, the keyboard and
 * `aria-activedescendant` are the platform's job. Fiat and crypto are named
 * groups inside one search rather than two tabs: a tab makes you pick a section
 * before you know which one holds what you want, and someone typing USDT would
 * have to notice they were on the wrong one and type it again. The headings
 * stick, so a long list never leaves you wondering which half you are in.
 *
 * Every word is a prop. The list is the same everywhere; what it is called is
 * not, and translations live in the app rather than in the design system.
 */
import { computed, ref, useId } from 'vue';
import type { HTMLAttributes } from 'vue';
import { ChevronRightIcon, ChevronsUpDownIcon } from '@lucide/vue';
import { cn } from '../../lib/utils';
import {
  Combobox,
  ComboboxAnchor,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
  ComboboxViewport,
} from '../ui/combobox';
import CurrencyIcon from '../currency-icon/CurrencyIcon.vue';
import { groupCurrencies, type CurrencyOption } from './filter';

const props = withDefaults(
  defineProps<{
    /** Every currency to offer, in the order the list should read. */
    options: readonly CurrencyOption[];
    /**
     * `row` for a form field, `compact` for the trigger beside an amount.
     */
    variant?: 'row' | 'compact';
    /** What the field is: «Валюта». Read by the screen reader in both variants. */
    label: string;
    /** Stands in for the value while there is none: «Выбрать валюту». */
    placeholder?: string;
    /** What the search field says when empty: «Поиск валюты». */
    searchPlaceholder?: string;
    /** What the list says when nothing matches. */
    emptyLabel?: string;
    /** The heading over the fiat block. */
    fiatLabel?: string;
    /** The heading over the crypto block. */
    cryptoLabel?: string;
    /** The heading over the shortcut block at the top. */
    frequentLabel?: string;
    /**
     * Codes to offer first — the currencies of this person's accounts, or the
     * ones the header switches between. They are lifted out of the blocks
     * below rather than repeated, so nothing appears twice in one list.
     */
    frequent?: readonly string[];
    /**
     * Codes that cannot be chosen — already added, already in use. They stay in
     * the list rather than disappearing from it: a currency that is simply
     * absent reads as one the app does not have, and the person searches for it
     * again.
     */
    disabledCodes?: readonly string[];
    /** What the mark beside a disabled row says: «уже добавлена». */
    disabledLabel?: string;
    /** What is wrong, in the screen's words. Announced, not only coloured. */
    error?: string;
    /** A quiet line under the value: why the field is locked, what it affects. */
    hint?: string;
    disabled?: boolean;
    class?: HTMLAttributes['class'];
  }>(),
  {
    variant: 'row',
    placeholder: undefined,
    searchPlaceholder: undefined,
    emptyLabel: undefined,
    fiatLabel: undefined,
    cryptoLabel: undefined,
    frequentLabel: undefined,
    frequent: () => [],
    disabledCodes: () => [],
    disabledLabel: undefined,
    error: undefined,
    hint: undefined,
    disabled: false,
    class: '',
  },
);

/** The currency code, upper case. Never null: an amount is always in something. */
const model = defineModel<string>({ required: true });

const open = ref(false);
const query = ref('');
const uid = useId();
const errorId = `${uid}-error`;
const headingId = `${uid}-group`;

const selected = computed(() => props.options.find((o) => o.code === model.value));

const groups = computed(() => groupCurrencies(props.options, query.value, props.frequent));

const unavailable = computed(() => new Set(props.disabledCodes));

const headings = computed<Record<string, string | undefined>>(() => ({
  frequent: props.frequentLabel,
  fiat: props.fiatLabel,
  crypto: props.cryptoLabel,
}));

/*
 * A fresh search every time the list opens: what was typed last time is not
 * what is being looked for now, and the chosen currency is already on screen.
 */
function onOpen(value: boolean) {
  open.value = value;
  if (value) query.value = '';
}
</script>

<template>
  <Combobox
    v-model="model"
    :open="open"
    :disabled="props.disabled"
    :ignore-filter="true"
    :reset-search-term-on-blur="false"
    @update:open="onOpen"
  >
    <ComboboxAnchor
      :data-slot="props.variant === 'row' ? 'form-field-row' : 'currency-compact'"
      :class="
        cn(
          'outline-offset-[-2px] focus-within:outline-2 focus-within:outline-ring',
          props.variant === 'row'
            ? 'bg-surface text-ink flex min-h-14 w-full items-center gap-3 rounded-lg px-3 py-2'
            : 'bg-surface-sunken text-ink flex min-h-11 shrink-0 items-center rounded-lg px-2',
          props.disabled && 'pointer-events-none opacity-50',
          props.error && 'ring-negative ring-1',
          props.class,
        )
      "
    >
      <ComboboxTrigger
        data-testid="currency-trigger"
        :aria-label="props.variant === 'compact' ? props.label : undefined"
        :aria-invalid="props.error ? 'true' : undefined"
        :aria-describedby="props.error ? errorId : undefined"
        :class="
          cn(
            'flex min-w-0 items-center text-left',
            props.variant === 'row' ? 'flex-1 gap-3' : 'gap-1.5',
          )
        "
      >
        <CurrencyIcon
          v-if="selected"
          :code="selected.code"
          :kind="selected.kind"
          :size="props.variant === 'row' ? 24 : 18"
        />

        <span v-if="props.variant === 'row'" class="flex min-w-0 flex-1 flex-col">
          <span class="text-muted-foreground text-xs">{{ props.label }}</span>
          <span
            data-testid="currency-value"
            :class="
              cn('truncate text-sm font-medium', !selected && 'text-muted-foreground font-normal')
            "
            >{{ selected?.name ?? props.placeholder }}</span
          >
          <!-- Red says something is wrong; only the words say what. -->
          <span v-if="props.error" :id="errorId" class="text-negative text-xs">{{
            props.error
          }}</span>
          <span v-else-if="props.hint" class="text-muted-foreground text-xs">{{ props.hint }}</span>
        </span>

        <!-- Compact: the code is the whole label, so it is set in the same mono
             face the amount's digits use and kept out of the number's way. -->
        <span
          v-else
          data-testid="currency-value"
          class="font-mono text-sm font-medium tracking-[0.06em] uppercase"
          >{{ model }}</span
        >

        <ChevronsUpDownIcon
          v-if="props.variant === 'compact'"
          aria-hidden="true"
          class="text-muted-foreground size-3.5 shrink-0"
        />
      </ComboboxTrigger>

      <ChevronRightIcon
        v-if="props.variant === 'row'"
        data-slot="row-chevron"
        aria-hidden="true"
        class="text-muted-foreground pointer-events-none size-5 shrink-0"
      />
    </ComboboxAnchor>

    <ComboboxList align="start" :class="props.variant === 'compact' ? 'w-64' : undefined">
      <!--
        `display-value` has to be pinned to the query. Left to itself the
        combobox writes the selected code into the search field when the list
        opens, which this component then reads as a search for that code — so
        the list opened showing one currency, the one you already had.
      -->
      <ComboboxInput
        v-model="query"
        :display-value="() => query"
        :placeholder="props.searchPlaceholder"
      />
      <ComboboxEmpty>{{ props.emptyLabel }}</ComboboxEmpty>
      <ComboboxViewport>
        <!--
          A plain `role="group"` rather than the combobox's own: that one hides
          itself when its items do not match the library's internal filter,
          which this component has switched off in favour of its own ranking,
          so every group but the first disappeared.
        -->
        <div
          v-for="group in groups"
          :key="group.id"
          role="group"
          :aria-labelledby="`${headingId}-${group.id}`"
          data-slot="combobox-group"
          :data-testid="`currency-group-${group.id}`"
        >
          <!-- Sticky rather than scrolled away: two hundred currencies is long
               enough to lose track of which half you are reading. -->
          <div
            :id="`${headingId}-${group.id}`"
            class="bg-popover text-muted-foreground sticky top-0 z-10 px-2 py-1.5 text-xs font-medium"
          >
            {{ headings[group.id] }}
          </div>
          <ComboboxItem
            v-for="currency in group.options"
            :key="`${group.id}-${currency.code}`"
            :value="currency.code"
            :disabled="unavailable.has(currency.code)"
            :data-testid="`currency-option-${currency.code}`"
            class="gap-3 px-2 py-2 pointer-coarse:min-h-11"
          >
            <CurrencyIcon :code="currency.code" :kind="currency.kind" :size="20" />
            <span class="min-w-0 flex-1 truncate">{{ currency.name }}</span>
            <span
              v-if="unavailable.has(currency.code) && props.disabledLabel"
              class="text-muted-foreground shrink-0 text-xs"
              >{{ props.disabledLabel }}</span
            >
            <span v-else-if="currency.symbol" class="text-muted-foreground shrink-0 text-xs">{{
              currency.symbol
            }}</span>
            <span class="text-muted-foreground shrink-0 font-mono text-xs tracking-[0.08em]">{{
              currency.code
            }}</span>
          </ComboboxItem>
        </div>
      </ComboboxViewport>
    </ComboboxList>
  </Combobox>
</template>
