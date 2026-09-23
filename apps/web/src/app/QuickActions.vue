<script setup lang="ts">
/**
 * What the "+" opens. It used to be a menu of three buttons, which put a tap in
 * front of every operation; it is now the sheet itself (reference slide 13),
 * with the kind of operation as a segment inside it. Writing an expense down is
 * one tap from anywhere.
 *
 * What is written rarely — a new income source, and a balance typed in by hand —
 * stays one tap away as the sheet's secondary actions, below the fields it is
 * not part of. The source opens on its own route, the same sheet the Plan uses.
 *
 * It holds the sheets, never the trigger that is part of the navigation: the
 * pill's "+" writes to `open`, so the sheet is reachable from every screen the
 * navigation is on. The floating button below is the wide window's own trigger,
 * where there is no pill, and it keeps to the two screens about money on hand.
 */
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { Button, Sheet, SheetContent, SheetHeader, SheetTitle } from '@magermoney/ui';
import { RecordBalanceSheet, useAccounts } from '@/modules/accounts';
import { OperationSheet } from '@/modules/plan';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const { accounts } = useAccounts();
/** The sheet's open state belongs to whoever put the trigger on screen. */
const menu = defineModel<boolean>('open', { default: false });
const pick = ref(false);
const record = ref(false);
const chosen = ref('');
const active = computed(() => accounts.value.filter((a) => a.archivedAt === null));
/** The desktop "+" belongs to the two screens about money on hand: the dashboard and the accounts list. */
const FAB_PATHS = ['/', '/accounts'];
const showFab = computed(() => FAB_PATHS.includes(route.path));
function choose(id: string) {
  chosen.value = id;
  pick.value = false;
  record.value = true;
}
function newIncomeSource() {
  menu.value = false;
  void router.push('/plan/income/new');
}
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

  <OperationSheet v-model:open="menu">
    <template #secondary>
      <Button
        variant="outline"
        class="min-h-11"
        data-testid="quick-income-source"
        @click="newIncomeSource"
      >
        {{ t('quick.incomeSource') }}
      </Button>
      <Button
        v-if="active.length > 0"
        variant="outline"
        class="min-h-11"
        data-testid="quick-record"
        @click="
          menu = false;
          pick = true;
        "
      >
        {{ t('quick.record') }}
      </Button>
    </template>
  </OperationSheet>

  <Sheet v-model:open="pick">
    <SheetContent
      side="bottom"
      class="max-h-[80dvh] overflow-y-auto rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]"
    >
      <SheetHeader>
        <SheetTitle>{{ t('quick.pickAccount') }}</SheetTitle>
      </SheetHeader>
      <ul class="divide-border/60 mt-2 divide-y">
        <li v-for="a in active" :key="a.id">
          <button
            type="button"
            class="flex min-h-11 w-full items-center justify-between py-2 text-left text-sm"
            :data-testid="`pick-${a.id}`"
            @click="choose(a.id)"
          >
            <span>{{ a.name }}</span
            ><span class="text-muted-foreground font-mono"
              >{{ a.balance ?? '—' }} {{ a.currency }}</span
            >
          </button>
        </li>
      </ul>
    </SheetContent>
  </Sheet>

  <RecordBalanceSheet v-if="chosen" v-model:open="record" :account-id="chosen" />
</template>
