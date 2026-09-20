<script setup lang="ts">
/**
 * Settings as a ledger page: a stack of hairline-separated rows, label on the
 * left, control on the right, no cards inside cards. Every change is saved the
 * moment it is made — there is no Save button, because there is nothing here
 * worth a second step — and shown immediately, with a toast if the PATCH fails.
 */
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  useToast,
} from '@magermoney/ui';
import { useSession } from '@/modules/auth';
import { CurrencySwitch } from '@/modules/rates';
import { usePageTitle } from '@/shared/layout/page-bar';
import { THEMES, useTheme, type Theme } from '@/shared/theme';
import { ApiError } from '@/shared/api/client';
import { LOCALES, type Locale } from '../domain/profile';
import { useProfile } from '../application/use-profile';
import CurrencyListEditor from './CurrencyListEditor.vue';

const { t, locale } = useI18n();
const { toast } = useToast();
const router = useRouter();
const session = useSession();
const { theme, set: setTheme } = useTheme();
const { profile, isLoading, update } = useProfile();

const displayName = ref('');
const saving = ref(false);

watch(
  profile,
  (p) => {
    if (p && document.activeElement?.id !== 'display-name') displayName.value = p.displayName ?? '';
    if (p && p.locale !== locale.value) locale.value = p.locale;
  },
  { immediate: true },
);

const currencies = computed(() => profile.value?.reportingCurrencies ?? []);

usePageTitle(() => t('settings.title'));

async function save(input: Parameters<typeof update>[0]): Promise<void> {
  saving.value = true;
  try {
    await update(input);
  } catch (e) {
    toast.error(e instanceof ApiError ? e.message : t('settings.saveFailed'));
  } finally {
    saving.value = false;
  }
}

function saveName(): void {
  const next = displayName.value.trim();
  if (next === (profile.value?.displayName ?? '')) return;
  void save({ displayName: next });
}

function saveLocale(next: Locale): void {
  locale.value = next;
  if (next !== profile.value?.locale) void save({ locale: next });
}

async function signOut(): Promise<void> {
  await session.signOut();
  await router.push({ name: 'sign-in' });
}
</script>

<template>
  <section class="pb-8">
    <!-- The bar carries this on a phone; a wide window's bar carries the links. -->
    <h1 class="sr-only text-2xl font-semibold tracking-[-0.01em] md:not-sr-only">
      {{ t('settings.title') }}
    </h1>

    <template v-if="isLoading && !profile">
      <div class="mt-8 flex flex-col gap-4">
        <Skeleton class="h-11 w-full" />
        <Skeleton class="h-11 w-full" />
        <Skeleton class="h-32 w-full" />
      </div>
    </template>

    <template v-else>
      <div class="mt-8 flex flex-col gap-6 border-t border-border pt-6 md:gap-5">
        <div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <label for="display-name" class="text-sm font-medium">
            {{ t('settings.displayName.label') }}
          </label>
          <Input
            id="display-name"
            v-model="displayName"
            type="text"
            autocomplete="name"
            maxlength="80"
            class="h-11 md:w-64"
            :placeholder="t('settings.displayName.placeholder')"
            @change="saveName"
            @blur="saveName"
          />
        </div>

        <div
          class="flex flex-col gap-2 border-t border-border pt-6 md:flex-row md:items-center md:justify-between md:pt-5"
        >
          <span id="language-label" class="text-sm font-medium">
            {{ t('settings.language.label') }}
          </span>
          <Select
            :model-value="locale"
            @update:model-value="(v: unknown) => saveLocale(String(v) as Locale)"
          >
            <SelectTrigger class="h-11 w-full md:w-64" aria-labelledby="language-label">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="l in LOCALES" :key="l" :value="l">
                {{ t(`settings.language.${l}`) }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div
          class="flex flex-col gap-2 border-t border-border pt-6 md:flex-row md:items-center md:justify-between md:pt-5"
        >
          <span id="theme-label" class="text-sm font-medium">
            {{ t('settings.theme.label') }}
          </span>
          <Select
            :model-value="theme"
            @update:model-value="(v: unknown) => setTheme(String(v) as Theme)"
          >
            <SelectTrigger class="h-11 w-full md:w-64" aria-labelledby="theme-label">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="th in THEMES" :key="th" :value="th">
                {{ t(`theme.${th}`) }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <!--
          The switch used to live in the top bar, on every screen. It belongs
          to the two places that answer "in what currency am I reading this" —
          Home, where the numbers are, and here, next to the list it picks
          from. A control repeated on every screen is one nobody reads.
        -->
        <div class="flex flex-col gap-2 border-t border-border pt-6 md:pt-5">
          <div class="flex flex-col gap-1">
            <span class="text-sm font-medium">
              {{ t('settings.display.label') }}
            </span>
            <span class="text-sm leading-relaxed text-muted-foreground">
              {{ t('settings.display.hint') }}
            </span>
          </div>
          <CurrencySwitch
            :rates-link="false"
            class="self-start"
            data-testid="settings-display-currency"
          />
        </div>

        <div class="border-t border-border pt-6 md:pt-5">
          <h2 class="text-sm font-medium">
            {{ t('settings.currencies.title') }}
          </h2>
          <p class="mt-1 max-w-prose text-sm leading-relaxed text-muted-foreground">
            {{ t('settings.currencies.hint') }}
          </p>
          <CurrencyListEditor
            v-if="profile"
            :selected="currencies"
            :default-currency="profile.defaultCurrency"
            :busy="saving"
            @change="(v) => save(v)"
          />
        </div>

        <div class="border-t border-border pt-6 md:pt-5">
          <RouterLink
            to="/settings/currencies"
            data-testid="settings-currencies"
            class="flex min-h-11 items-center justify-between gap-4 rounded-lg outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
          >
            <span>
              <span class="block text-sm font-medium">{{ t('currencies.title') }}</span>
              <span class="mt-1 block text-sm leading-relaxed text-muted-foreground">{{
                t('currencies.settingsHint')
              }}</span>
            </span>
            <span class="text-muted-foreground" aria-hidden="true">→</span>
          </RouterLink>
        </div>

        <div class="border-t border-border pt-6 md:pt-5">
          <RouterLink
            to="/settings/rates"
            data-testid="settings-rates"
            class="flex min-h-11 items-center justify-between gap-4 rounded-lg outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
          >
            <span>
              <span class="block text-sm font-medium">{{ t('settings.rates.label') }}</span>
              <span class="mt-1 block text-sm leading-relaxed text-muted-foreground">{{
                t('settings.rates.hint')
              }}</span>
            </span>
            <span class="text-muted-foreground" aria-hidden="true">→</span>
          </RouterLink>
        </div>

        <div class="border-t border-border pt-6 md:pt-5">
          <Button variant="outline" type="button" class="h-11" @click="signOut">
            {{ t('settings.signOut') }}
          </Button>
        </div>
      </div>
    </template>
  </section>
</template>
