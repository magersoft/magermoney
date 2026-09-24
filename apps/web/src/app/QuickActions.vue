<script setup lang="ts">
/**
 * What the "+" opens. It used to be a menu of three buttons, which put a tap in
 * front of every operation; it is now the sheet itself (reference slide 13),
 * with the kind of operation as a segment inside it. Writing an expense down is
 * one tap from anywhere.
 *
 * The sheet writes one operation and nothing else. What is written rarely has
 * its own home: a new income source in Plan → Income (and in the inflow form's
 * source picker), a balance typed in by hand on the account's own screen.
 *
 * It holds the sheet, never the trigger that is part of the navigation: the
 * pill's "+" writes to `open`, so the sheet is reachable from every screen the
 * navigation is on. The floating button below is the wide window's own trigger,
 * where there is no pill, and it keeps to the two screens about money on hand.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import { Button } from '@magermoney/ui';
import { OperationSheet } from '@/modules/plan';

const { t } = useI18n();
const route = useRoute();
/** The sheet's open state belongs to whoever put the trigger on screen. */
const menu = defineModel<boolean>('open', { default: false });
/** The desktop "+" belongs to the two screens about money on hand: the dashboard and the accounts list. */
const FAB_PATHS = ['/', '/accounts'];
const showFab = computed(() => FAB_PATHS.includes(route.path));
</script>

<template>
  <Button
    v-if="showFab"
    size="icon-lg"
    class="size-14 rounded-full shadow-lg"
    :aria-label="t('quick.open')"
    data-testid="fab"
    @click="menu = true"
  >
    +
  </Button>

  <OperationSheet v-model:open="menu" />
</template>
