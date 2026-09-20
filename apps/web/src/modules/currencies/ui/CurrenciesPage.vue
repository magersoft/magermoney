<script setup lang="ts">
/**
 * Which currencies this person uses, and which three of them the display
 * switch offers.
 *
 * The catalogue holds a couple of hundred; this screen is the short list they
 * picked out of it, and the one place to add to it or take something off. Every
 * other screen — the account form, the budget wizard, the rates list — offers
 * exactly what is here.
 *
 * The switch's currencies sit at the top, in the order the switch shows them,
 * because that list is read as a picture of the control it drives: someone
 * checking what the header will look like should not have to assemble it from
 * ticks scattered down a list of twenty. Everything else follows underneath.
 *
 * The rows say two things a code cannot: the currency's name, and whether
 * anyone quotes a rate for it. A currency nobody quotes still works; it just
 * needs a rate typed by hand, and saying so here is what keeps an unconverted
 * amount from reading as a zero later (ADR 0006).
 */
import { computed, ref } from 'vue';
import { StarIcon } from '@lucide/vue';
import { useI18n } from 'vue-i18n';
import { MAX_REPORTING_CURRENCIES } from '@magermoney/contracts';
import { Button, CurrencyIcon, CurrencySelect, Skeleton, useToast } from '@magermoney/ui';
import { useProfile } from '@/modules/profile';
import { ApiError } from '@/shared/api/client';
import { usePageAction, usePageTitle } from '@/shared/layout/page-bar';
import {
  addToSwitch,
  makeMain,
  moveInSwitch,
  removeFromSwitch,
  reorderSwitch,
  type SwitchList,
} from '../domain/switch-list';
import {
  useConnectedCurrencies,
  useCurrencies,
  useCurrencyCatalogue,
} from '../application/use-currencies';
import { useCurrencyOptions } from '../application/use-currency-options';
import { useDragReorder } from './use-drag-reorder';

const { t } = useI18n();
const { toast } = useToast();

const connected = useCurrencies();
const { connect, disconnect, isPending } = useConnectedCurrencies();
const { profile, update } = useProfile();

/*
 * The catalogue is a couple of hundred rows and no other screen wants it — but
 * this one exists to add a currency out of it, so it is fetched on arrival
 * rather than gated behind opening the picker.
 */
const { currencies: catalogue, isLoading: loadingCatalogue } = useCurrencyCatalogue();
const catalogueOptions = useCurrencyOptions(catalogue);
const options = useCurrencyOptions(connected);

const connectedCodes = computed(() => connected.value.map((c) => c.code));

const switchList = computed<SwitchList>(() => ({
  reportingCurrencies: profile.value?.reportingCurrencies ?? [],
  defaultCurrency: profile.value?.defaultCurrency ?? '',
}));
const inSwitch = computed(() => switchList.value.reportingCurrencies);
const full = computed(() => inSwitch.value.length >= MAX_REPORTING_CURRENCIES);

/* Joined once here rather than looked up per row inside the template. */
const rows = computed(() =>
  options.value.map((o, i) => ({ ...o, quoted: connected.value[i]?.rateSource !== null })),
);
const byCode = computed(() => new Map(rows.value.map((r) => [r.code, r])));

/** The switch's own currencies, in the order it shows them. */
const switchRows = computed(() => inSwitch.value.flatMap((c) => byCode.value.get(c) ?? []));
const otherRows = computed(() => rows.value.filter((r) => !inSwitch.value.includes(r.code)));

usePageTitle(() => t('currencies.title'));
/*
 * The bar's action opens the same picker the row does, rather than being a
 * second way to add a currency: two controls that do one thing are two places
 * for the list to disagree about what is already connected.
 */
const picker = ref<HTMLElement | null>(null);
usePageAction(() => ({
  label: t('currencies.add'),
  ariaLabel: t('currencies.addAria'),
  onSelect: () =>
    picker.value?.querySelector<HTMLElement>('[data-testid="currency-trigger"]')?.click(),
  pending: isPending.value,
  testid: 'currencies-add',
}));

/*
 * The picker is an action, not a field: choosing a currency connects it and the
 * control returns to its placeholder. `pending` is never a real currency, so
 * binding it two-way is safe.
 */
const pending = ref('');
async function onPick(code: string) {
  pending.value = '';
  if (!code) return;
  try {
    await connect(code);
  } catch {
    toast(t('currencies.addFailed'));
  }
}

async function remove(code: string) {
  try {
    await disconnect(code);
  } catch (e) {
    /* The API already wrote the sentence: which accounts, which budgets. */
    toast(e instanceof ApiError ? e.message : t('currencies.removeFailed'));
  }
}

/**
 * Every change to the switch goes through here, so the disabled states above
 * and the request below cannot disagree: a move the rules refuse returns null,
 * and nothing is sent.
 */
async function applySwitch(next: SwitchList | null) {
  if (!next) return;
  try {
    await update(next);
  } catch (e) {
    toast(e instanceof ApiError ? e.message : t('currencies.switchFailed'));
  }
}

const toggle = (code: string) =>
  applySwitch(
    inSwitch.value.includes(code)
      ? removeFromSwitch(switchList.value, code)
      : addToSwitch(switchList.value, code),
  );

/*
 * Dragging is the gesture the order deserves — two arrows per row is four
 * controls to read before the first move. The keyboard keeps the arrows, on the
 * handle itself, so the order is reachable without a pointer.
 */
const switchListEl = ref<HTMLElement | null>(null);
const {
  dragging,
  offsetOf,
  start: startDrag,
} = useDragReorder(switchListEl, (from, to) =>
  applySwitch(reorderSwitch(switchList.value, from, to)),
);
</script>

<template>
  <section class="pb-8">
    <!-- The bar carries this on a phone; a wide window's bar carries the links. -->
    <h1 class="sr-only text-2xl font-semibold tracking-[-0.01em] md:not-sr-only">
      {{ t('currencies.title') }}
    </h1>
    <p class="text-muted-foreground mt-1 text-xs">
      {{ t('currencies.hint') }}
    </p>

    <div ref="picker" class="mt-4">
      <!-- No `:key` to force a remount: `onPick` clears `pending` itself, and
           remounting would rebuild a list of two hundred rows on every add. -->
      <CurrencySelect
        v-model="pending"
        :options="catalogueOptions"
        :disabled-codes="connectedCodes"
        :disabled-label="t('currencies.alreadyAdded')"
        :label="t('currencies.add')"
        :placeholder="loadingCatalogue ? t('currencies.loading') : t('currencySelect.placeholder')"
        :search-placeholder="t('currencySelect.search')"
        :empty-label="t('currencySelect.empty')"
        :fiat-label="t('currencySelect.fiat')"
        :crypto-label="t('currencySelect.crypto')"
        :disabled="isPending"
        data-testid="currencies-picker"
        @update:model-value="onPick"
      />
    </div>

    <Skeleton v-if="connected.length === 0" class="mt-4 h-12 w-full" />

    <template v-else>
      <section class="mt-6" aria-labelledby="switch-heading">
        <div class="flex items-baseline justify-between gap-3">
          <h2 id="switch-heading" class="text-sm font-medium">
            {{ t('currencies.switchSection') }}
          </h2>
          <!-- The counter is the answer to "why can I not tick this one". -->
          <span
            class="text-muted-foreground shrink-0 font-mono text-xs tabular-nums"
            data-testid="switch-count"
            >{{
              t('currencies.switchCount', { n: inSwitch.length, max: MAX_REPORTING_CURRENCIES })
            }}</span
          >
        </div>
        <p class="text-muted-foreground mt-1 text-sm leading-relaxed">
          {{ full ? t('currencies.switchFull') : t('currencies.switchHint') }}
        </p>

        <p id="switch-reorder-hint" class="sr-only">
          {{ t('currencies.reorderHint') }}
        </p>
        <ul ref="switchListEl" class="mt-3 space-y-1" data-testid="switch-list">
          <li
            v-for="(c, i) in switchRows"
            :key="c.code"
            :data-testid="`switch-row-${c.code}`"
            :class="[
              'bg-background flex min-h-14 items-center gap-1 rounded-lg py-2 pr-1',
              /* The row under the finger rides above the rest and stops
                 animating: it is already following the pointer. */
              dragging === i
                ? 'ring-border relative z-10 shadow-lg ring-1'
                : 'transition-transform duration-150',
              dragging !== null && 'select-none',
            ]"
            :style="{ transform: offsetOf(i) ? `translateY(${offsetOf(i)}px)` : undefined }"
          >
            <!--
              The grip is the whole drag target, not the row: a row that drags
              anywhere cannot also be tapped, and every other control on it is a
              tap. `touch-action: none` is what stops the phone reading the
              press as the start of a scroll.
            -->
            <button
              type="button"
              class="text-muted-foreground hover:text-foreground outline-ring flex size-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-md outline-offset-[-2px] focus-visible:outline-2 active:cursor-grabbing"
              :aria-label="t('currencies.reorder', { code: c.code })"
              :title="t('currencies.reorder', { code: c.code })"
              aria-describedby="switch-reorder-hint"
              :data-testid="`switch-drag-${c.code}`"
              @pointerdown="startDrag($event, i)"
              @keydown.up.prevent="applySwitch(moveInSwitch(switchList, c.code, -1))"
              @keydown.down.prevent="applySwitch(moveInSwitch(switchList, c.code, 1))"
            >
              <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                class="size-4"
                aria-hidden="true"
                focusable="false"
              >
                <circle cx="9" cy="6" r="1.5" />
                <circle cx="15" cy="6" r="1.5" />
                <circle cx="9" cy="12" r="1.5" />
                <circle cx="15" cy="12" r="1.5" />
                <circle cx="9" cy="18" r="1.5" />
                <circle cx="15" cy="18" r="1.5" />
              </svg>
            </button>

            <CurrencyIcon :code="c.code" :kind="c.kind" :size="24" />
            <span class="flex min-w-0 flex-1 flex-col">
              <span class="truncate text-sm">{{ c.name }}</span>
              <!-- The star is the control; this is the word for what it did. -->
              <span
                v-if="c.code === switchList.defaultCurrency"
                class="text-muted-foreground text-xs"
                :data-testid="`main-note-${c.code}`"
                >{{ t('currencies.main') }}</span
              >
            </span>

            <!--
              Which currency every new form starts from. Still a radio
              underneath — it is one of these, and a screen reader should hear
              that — wearing the star this app already uses for the account it
              keeps on the Home screen. Filled is on; the outline never pretends
              to be.
            -->
            <label
              class="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-md"
              :title="t('currencies.makeMain', { code: c.code })"
            >
              <input
                type="radio"
                name="main-currency"
                class="peer sr-only"
                :value="c.code"
                :checked="c.code === switchList.defaultCurrency"
                :aria-label="t('currencies.makeMain', { code: c.code })"
                :data-testid="`switch-main-${c.code}`"
                @change="applySwitch(makeMain(switchList, c.code))"
              />
              <StarIcon
                :size="20"
                class="outline-ring rounded-sm outline-offset-4 transition-colors peer-focus-visible:outline-2"
                :class="
                  c.code === switchList.defaultCurrency
                    ? 'text-primary fill-current'
                    : 'text-muted-foreground/60'
                "
              />
            </label>

            <label class="flex min-h-11 shrink-0 cursor-pointer items-center px-1">
              <input
                type="checkbox"
                checked
                class="accent-primary outline-ring size-4 outline-offset-2 focus-visible:outline-2 disabled:opacity-50"
                :disabled="switchRows.length < 2"
                :aria-label="t('currencies.inSwitchAria', { code: c.code })"
                :data-testid="`switch-toggle-${c.code}`"
                @change="toggle(c.code)"
              />
            </label>

            <!-- Disconnecting works here too: the backend takes the currency out
                 of the switch on the way, so there is no order to get right. -->
            <Button
              variant="ghost"
              size="icon"
              type="button"
              class="shrink-0 pointer-coarse:size-11"
              :disabled="connected.length < 2 || isPending"
              :aria-label="t('currencies.remove', { code: c.code })"
              :title="t('currencies.remove', { code: c.code })"
              :data-testid="`currency-remove-${c.code}`"
              @click="remove(c.code)"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                class="size-4"
                aria-hidden="true"
              >
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </Button>
          </li>
        </ul>
        <!-- Said once, next to the list it applies to, rather than on every row. -->
        <p
          v-if="switchRows.length < 2"
          class="text-muted-foreground mt-2 text-xs"
          data-testid="switch-last-note"
        >
          {{ t('currencies.lastInSwitch') }}
        </p>
      </section>

      <section v-if="otherRows.length > 0" class="mt-8" aria-labelledby="others-heading">
        <h2 id="others-heading" class="text-sm font-medium">
          {{ t('currencies.others') }}
        </h2>
        <ul class="divide-border/60 mt-3 divide-y" data-testid="currencies-list">
          <li
            v-for="c in otherRows"
            :key="c.code"
            :data-testid="`currency-row-${c.code}`"
            class="flex min-h-14 items-center gap-3 py-2"
          >
            <CurrencyIcon :code="c.code" :kind="c.kind" :size="24" />
            <span class="flex min-w-0 flex-1 flex-col">
              <span class="truncate text-sm">{{ c.name }}</span>
              <span v-if="!c.quoted" class="text-muted-foreground text-xs">{{
                t('currencies.noRateSource')
              }}</span>
            </span>
            <span class="text-muted-foreground shrink-0 font-mono text-xs tracking-[0.08em]">{{
              c.code
            }}</span>

            <label class="flex min-h-11 shrink-0 cursor-pointer items-center px-1">
              <input
                type="checkbox"
                class="accent-primary outline-ring size-4 outline-offset-2 focus-visible:outline-2 disabled:opacity-50"
                :disabled="full"
                :aria-label="t('currencies.inSwitchAria', { code: c.code })"
                :data-testid="`switch-toggle-${c.code}`"
                @change="toggle(c.code)"
              />
            </label>

            <Button
              variant="ghost"
              size="icon"
              type="button"
              class="shrink-0 pointer-coarse:size-11"
              :disabled="connected.length < 2 || isPending"
              :aria-label="t('currencies.remove', { code: c.code })"
              :title="t('currencies.remove', { code: c.code })"
              :data-testid="`currency-remove-${c.code}`"
              @click="remove(c.code)"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                class="size-4"
                aria-hidden="true"
              >
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </Button>
          </li>
        </ul>
      </section>
    </template>
  </section>
</template>
