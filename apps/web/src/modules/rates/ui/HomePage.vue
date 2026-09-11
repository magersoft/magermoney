<script setup lang="ts">
/**
 * The home screen, in the shape it will keep: a greeting, one amount in the
 * signature lockup, and the date the rate behind it came from. Accounts arrive
 * next phase, so the rest of the page says so plainly instead of pretending to
 * be a dashboard.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Card, CardContent, CardHeader, CardTitle, Skeleton } from '@magermoney/ui';
import { useSession } from '@/modules/auth';
import { greetingName, useProfile } from '@/modules/profile';
import { useRates } from '../application/use-rates';
import MoneyText from './MoneyText.vue';

/** The sample stands in for a real balance until accounts exist. */
const SAMPLE = { amount: '1000', currency: 'EUR' } as const;

const { t } = useI18n();
const { user } = useSession();
const { profile } = useProfile();
const { table, date } = useRates();

const name = computed(() => greetingName(profile.value, user.value?.email ?? null));
</script>

<template>
  <section class="pb-8">
    <h1
      data-testid="home-greeting"
      class="text-2xl font-semibold tracking-[-0.01em]"
    >
      {{ name ? t('home.greeting', { name }) : t('home.greetingPlain') }}
    </h1>

    <Card class="mt-8">
      <CardHeader>
        <CardTitle class="font-mono text-xs font-normal uppercase tracking-[0.08em] text-muted-foreground">
          {{ t('home.sample') }}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Skeleton
          v-if="!table"
          class="h-10 w-40"
        />
        <MoneyText
          v-else
          data-testid="sample-amount"
          class="text-[32px]"
          :amount="SAMPLE.amount"
          :currency="SAMPLE.currency"
        />
        <p class="mt-2 text-xs text-muted-foreground">
          {{ t('home.rateDate', { date }) }}
        </p>
      </CardContent>
    </Card>

    <p class="mt-6 max-w-prose text-sm leading-relaxed text-muted-foreground">
      {{ t('home.soon') }}
    </p>
  </section>
</template>
