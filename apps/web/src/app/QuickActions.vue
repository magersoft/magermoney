<script setup lang="ts">
/** The "+" on Home and Accounts: record a balance (pick the account first), make a transfer, or record an inflow. */
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import { Button, Sheet, SheetContent, SheetHeader, SheetTitle } from '@magermoney/ui';
import { RecordBalanceSheet, useAccounts } from '@/modules/accounts';
import { TransferSheet } from '@/modules/transfers';
import { routeComponent } from '@/shared/layout/route-fallback';

/**
 * Lazy, unlike its two neighbours: the income barrel is otherwise reached only
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
const menu = ref(false);
const pick = ref(false);
const record = ref(false);
const transfer = ref(false);
const inflow = ref(false);
/** Mounted on first use, so the chunk is not fetched until someone asks for it. */
const inflowWanted = ref(false);
const chosen = ref('');
const active = computed(() => accounts.value.filter((a) => a.archivedAt === null));
/** The "+" belongs to the two screens about money on hand: the dashboard and the accounts list. */
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
  <template v-if="showFab">
    <Button
      size="icon-lg"
      class="size-14 rounded-full shadow-lg"
      :aria-label="t('quick.open')"
      data-testid="fab"
      @click="menu = true"
    >
      +
    </Button>
    <Sheet v-model:open="menu">
      <SheetContent side="bottom" class="rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]">
        <SheetHeader>
          <SheetTitle>{{ t('quick.open') }}</SheetTitle>
        </SheetHeader>
        <div class="mt-4 grid gap-2">
          <template v-if="active.length > 0">
            <Button
              size="lg"
              variant="outline"
              class="min-h-9 pointer-coarse:min-h-11"
              data-testid="quick-record"
              @click="
                menu = false;
                pick = true;
              "
            >
              {{ t('quick.record') }}
            </Button>
            <Button
              size="lg"
              variant="outline"
              class="min-h-9 pointer-coarse:min-h-11"
              data-testid="quick-transfer"
              @click="
                menu = false;
                transfer = true;
              "
            >
              {{ t('quick.transfer') }}
            </Button>
          </template>
          <Button
            size="lg"
            variant="outline"
            class="min-h-9 pointer-coarse:min-h-11"
            data-testid="quick-inflow"
            @click="openInflow"
          >
            {{ t('quick.inflow') }}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
    <Sheet v-model:open="pick">
      <SheetContent
        side="bottom"
        class="max-h-[80dvh] overflow-y-auto rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        <SheetHeader>
          <SheetTitle>{{ t('quick.pickAccount') }}</SheetTitle>
        </SheetHeader>
        <ul class="mt-2 divide-y divide-border/60">
          <li v-for="a in active" :key="a.id">
            <button
              type="button"
              class="flex min-h-9 w-full items-center justify-between py-2 text-left text-sm pointer-coarse:min-h-11"
              :data-testid="`pick-${a.id}`"
              @click="choose(a.id)"
            >
              <span>{{ a.name }}</span
              ><span class="font-mono text-muted-foreground"
                >{{ a.balance ?? '—' }} {{ a.currency }}</span
              >
            </button>
          </li>
        </ul>
      </SheetContent>
    </Sheet>
    <RecordBalanceSheet v-if="chosen" v-model:open="record" :account-id="chosen" />
    <TransferSheet v-model:open="transfer" />
    <InflowSheet v-if="inflowWanted" v-model:open="inflow" />
  </template>
</template>
