<script setup lang="ts">
/**
 * What the "+" opens. It used to be a menu of three buttons, which put a tap in
 * front of every operation; it is now the sheet itself (reference slide 13),
 * with the kind of operation as a segment inside it. Writing an expense down is
 * one tap from anywhere.
 *
 * The two things that are not operations on the plan — recording what actually
 * arrived, and writing down a balance — stay one tap away as the sheet's
 * secondary actions, below the fields they are not part of.
 *
 * It holds the sheets, never the trigger that is part of the navigation: the
 * pill's "+" writes to `open`, so the sheet is reachable from every screen the
 * navigation is on. The floating button below is the wide window's own trigger,
 * where there is no pill, and it keeps to the two screens about money on hand.
 */
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import { Button, Sheet, SheetContent, SheetHeader, SheetTitle } from '@magermoney/ui';
import { RecordBalanceSheet, useAccounts } from '@/modules/accounts';
import { OperationSheet } from '@/modules/plan';
import { routeComponent } from '@/shared/layout/route-fallback';

/**
 * Lazy, unlike its neighbours: the income barrel is otherwise reached only
 * through routed screens, and a static import here would put the whole module
 * into the entry chunk for a sheet most sessions never open.
 *
 * Wrapped like a routed screen: a chunk that a deploy took away must leave a
 * sentence and a Reload button behind, not a button that answers with nothing.
 */
const InflowSheet = routeComponent(() => import('@/modules/income').then((m) => m.InflowSheet));

const { t } = useI18n();
const route = useRoute();
const { accounts } = useAccounts();
/** The sheet's open state belongs to whoever put the trigger on screen. */
const menu = defineModel<boolean>('open', { default: false });
const pick = ref(false);
const record = ref(false);
const inflow = ref(false);
/** Mounted on first use, so the chunk is not fetched until someone asks for it. */
const inflowWanted = ref(false);
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
function openInflow() {
  menu.value = false;
  inflowWanted.value = true;
  inflow.value = true;
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
      <Button variant="outline" class="min-h-11" data-testid="quick-inflow" @click="openInflow">
        {{ t('quick.inflow') }}
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
  <InflowSheet v-if="inflowWanted" v-model:open="inflow" />
</template>
