<script setup lang="ts">
/**
 * Where an account is held, picked from a list of 257 rather than typed as two
 * letters nobody remembers.
 *
 * It keeps the row language of the forms around it (`FieldRow`): the surface,
 * the 56px height, the label above the value, the chevron that says this one
 * opens. What opens is a combobox — reka-ui's, so the roles, the keyboard and
 * `aria-activedescendant` are the platform's job rather than ours.
 *
 * The words are all props. The list is the same everywhere; what it is called
 * is not, and translations live in the app rather than in the design system.
 */
import { computed, ref, useId } from 'vue';
import type { HTMLAttributes } from 'vue';
import { ChevronRightIcon, XIcon } from '@lucide/vue';
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
import CountryFlag from './CountryFlag.vue';
import { filterCountries, type CountryOption } from './filter';

const props = withDefaults(
  defineProps<{
    /** Every country, in the order the list should read — usually by name. */
    options: readonly CountryOption[];
    /** What the field is: «Страна». */
    label: string;
    /** Stands in for the value while there is none: «Выбрать страну». */
    placeholder?: string;
    /** What the search field says when empty: «Поиск страны». */
    searchPlaceholder?: string;
    /** What the list says when nothing matches. */
    emptyLabel?: string;
    /** The accessible name of the button that empties the field. */
    clearLabel?: string;
    /** What is wrong, in the screen's words. Announced, not only coloured. */
    error?: string;
    /** Without it the field cannot be emptied once it holds a country. */
    clearable?: boolean;
    disabled?: boolean;
    class?: HTMLAttributes['class'];
  }>(),
  {
    placeholder: undefined,
    searchPlaceholder: undefined,
    emptyLabel: undefined,
    clearLabel: undefined,
    error: undefined,
    clearable: true,
    disabled: false,
    class: '',
  },
);

/** The alpha-2 code, upper case, or `null` for no country. */
const model = defineModel<string | null>({ default: null });

const open = ref(false);
const query = ref('');
const errorId = `${useId()}-error`;

const selected = computed(() =>
  model.value ? props.options.find((o) => o.code === model.value) : undefined,
);
const shown = computed(() => filterCountries(props.options, query.value));

/*
 * A fresh search every time the list opens: what was typed last time is not what is
 * being looked for now, and the selected country is already on screen.
 */
function onOpen(value: boolean) {
  open.value = value;
  if (value) query.value = '';
}

function clear() {
  model.value = null;
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
      data-slot="form-field-row"
      :class="
        cn(
          'bg-surface text-ink flex min-h-14 w-full items-center gap-3 rounded-lg px-3 py-2',
          'outline-offset-[-2px] focus-within:outline-2 focus-within:outline-ring',
          props.disabled && 'pointer-events-none opacity-50',
          props.error && 'ring-negative ring-1',
          props.class,
        )
      "
    >
      <ComboboxTrigger
        data-testid="country-trigger"
        :aria-invalid="props.error ? 'true' : undefined"
        :aria-describedby="props.error ? errorId : undefined"
        :class="cn('flex min-w-0 flex-1 items-center gap-3 text-left')"
      >
        <CountryFlag v-if="selected" :code="selected.code" :size="24" />
        <span class="flex min-w-0 flex-1 flex-col">
          <span class="text-muted-foreground text-xs">{{ props.label }}</span>
          <span
            data-testid="country-value"
            :class="
              cn('truncate text-sm font-medium', !selected && 'text-muted-foreground font-normal')
            "
            >{{ selected?.name ?? props.placeholder }}</span
          >
          <!-- Red says something is wrong; only the words say what. -->
          <span v-if="props.error" :id="errorId" class="text-negative text-xs">{{
            props.error
          }}</span>
        </span>
      </ComboboxTrigger>

      <!-- Clearing is its own control, so it cannot be hit while reaching for the list. -->
      <button
        v-if="props.clearable && selected"
        type="button"
        data-testid="country-clear"
        :aria-label="props.clearLabel"
        class="text-muted-foreground hover:text-ink outline-ring grid size-8 shrink-0 place-items-center rounded-full outline-offset-2 focus-visible:outline-2 pointer-coarse:size-11"
        @click="clear"
      >
        <XIcon class="size-4" />
      </button>
      <ChevronRightIcon
        v-else
        data-slot="row-chevron"
        aria-hidden="true"
        class="text-muted-foreground pointer-events-none size-5 shrink-0"
      />
    </ComboboxAnchor>

    <ComboboxList align="start">
      <!--
        `display-value` has to be pinned to the query. Left to itself the
        combobox writes the chosen country's code into the search field when the
        list opens, which this component then reads as a search for that code —
        so editing an account showed a list of exactly the country it already
        had.
      -->
      <ComboboxInput
        v-model="query"
        :display-value="() => query"
        :placeholder="props.searchPlaceholder"
      />
      <ComboboxEmpty>{{ props.emptyLabel }}</ComboboxEmpty>
      <ComboboxViewport>
        <ComboboxItem
          v-for="country in shown"
          :key="country.code"
          :value="country.code"
          :data-testid="`country-option-${country.code}`"
          class="gap-3 px-2 py-2 pointer-coarse:min-h-11"
        >
          <CountryFlag :code="country.code" :size="20" />
          <span class="min-w-0 flex-1 truncate">{{ country.name }}</span>
          <span class="text-muted-foreground font-mono text-xs tracking-[0.08em]">{{
            country.code
          }}</span>
        </ComboboxItem>
      </ComboboxViewport>
    </ComboboxList>
  </Combobox>
</template>
