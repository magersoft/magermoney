<script setup lang="ts">
/** One account: what it holds, what it is, and everything it ever held. */
import { computed, defineAsyncComponent, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import type { BalanceEntryDto } from '@magermoney/contracts';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Skeleton,
  useToast,
} from '@magermoney/ui';
import { MoneyText } from '@/modules/rates';
import { ApiError } from '@/shared/api/client';
import { formatDate } from '@/shared/dates/format';
import { ACCOUNT_KIND_KEYS } from '../domain/labels';
import { useAccount } from '../application/use-accounts';
import { useAccountBalances } from '../application/use-account-balances';
import { useArchiveAccount, useDeleteAccount } from '../application/use-account-mutations';
import BalanceTimeline from './BalanceTimeline.vue';
import RecordBalanceSheet from './RecordBalanceSheet.vue';

/**
 * Loaded lazily rather than imported from `@/modules/transfers`: a static
 * import there would create an ESM cycle (accounts <-> transfers), since
 * transfers will need account data too.
 */
const TransferSheet = defineAsyncComponent(() =>
  import('@/modules/transfers').then((m) => m.TransferSheet),
);

const route = useRoute();
const router = useRouter();
const { t, locale } = useI18n();
const { toast } = useToast();
const id = computed(() => String(route.params.id));
const account = useAccount(id);
const { entries, isLoading } = useAccountBalances(id);
const { setArchived } = useArchiveAccount();
const { remove } = useDeleteAccount();

const balanceOpen = ref(false);
const transferOpen = ref(false);
const editing = ref<BalanceEntryDto | undefined>();
const confirmDelete = ref(false);
const latestManualId = computed(() =>
  entries.value[0]?.origin === 'manual' ? entries.value[0].id : null,
);

function openRecord(entry?: BalanceEntryDto) {
  editing.value = entry;
  balanceOpen.value = true;
}
async function archive() {
  if (!account.value) return;
  await setArchived(account.value.id, account.value.archivedAt === null);
}
async function del() {
  if (!account.value) return;
  try {
    await remove(account.value.id);
    await router.replace('/');
  } catch (e) {
    toast(
      e instanceof ApiError && e.status === 409
        ? t('accounts.detail.hasTransfers')
        : t('accounts.form.saveFailed'),
    );
  }
}
</script>

<template>
  <section v-if="account" class="pb-8">
    <header class="flex items-start gap-3">
      <div class="min-w-0 flex-1">
        <h1 class="truncate text-2xl font-semibold tracking-[-0.01em]" data-testid="account-name">
          {{ account.name }}
        </h1>
        <p class="text-sm text-muted-foreground">
          {{ t(ACCOUNT_KIND_KEYS[account.kind]) }} · {{ account.bank }} · {{ account.country }}
        </p>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button
            variant="ghost"
            size="icon"
            :aria-label="t('accounts.detail.edit')"
            data-testid="account-menu"
          >
            <span aria-hidden="true">⋯</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem @select="router.push(`/accounts/${account.id}/edit`)">
            {{ t('accounts.detail.edit') }}
          </DropdownMenuItem>
          <DropdownMenuItem @select="archive">
            {{ account.archivedAt ? t('accounts.detail.unarchive') : t('accounts.detail.archive') }}
          </DropdownMenuItem>
          <DropdownMenuItem
            @select="router.push({ path: '/transfers', query: { accountId: account.id } })"
          >
            {{ t('accounts.detail.transfers') }}
          </DropdownMenuItem>
          <DropdownMenuItem class="text-destructive" @select="confirmDelete = true">
            {{ t('accounts.detail.delete') }}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>

    <div class="mt-6">
      <p class="font-mono text-[32px] leading-[1.1] tabular-nums" data-testid="account-balance">
        {{ account.balance ?? '—' }} {{ account.currency }}
      </p>
      <MoneyText
        v-if="account.balance"
        class="text-sm text-muted-foreground"
        :amount="account.balance"
        :currency="account.currency"
      />
      <p v-else class="text-sm text-muted-foreground">
        {{ t('accounts.noBalance') }}
      </p>
    </div>

    <div class="mt-5 grid grid-cols-2 gap-2">
      <Button size="lg" data-testid="account-record" @click="openRecord()">
        {{ t('accounts.detail.recordBalance') }}
      </Button>
      <Button
        size="lg"
        variant="outline"
        data-testid="account-transfer"
        @click="transferOpen = true"
      >
        {{ t('accounts.detail.transfer') }}
      </Button>
    </div>

    <section v-if="account.kind === 'card' || account.note" class="mt-8">
      <h2 class="font-mono text-xs uppercase tracking-[0.08em] text-muted-foreground">
        {{ t('accounts.detail.details') }}
      </h2>
      <p v-if="account.kind === 'card'" class="mt-2 text-sm">
        {{
          t('accounts.detail.card', {
            network: account.cardNetwork ?? '',
            tier: account.cardTier ?? '',
            last4: account.cardLast4 ? `•••• ${account.cardLast4}` : '',
          })
        }}
        <span v-if="account.cardExpires" class="text-muted-foreground">
          ·
          {{
            t('accounts.detail.expires', {
              date: formatDate(account.cardExpires, locale as 'ru' | 'en'),
            })
          }}</span
        >
      </p>
      <pre
        v-if="account.note"
        class="mt-2 whitespace-pre-wrap font-sans text-sm text-muted-foreground"
        >{{ account.note }}</pre>
    </section>

    <section class="mt-8">
      <h2 class="font-mono text-xs uppercase tracking-[0.08em] text-muted-foreground">
        {{ t('accounts.detail.history') }}
      </h2>
      <Skeleton v-if="isLoading" class="mt-3 h-12 w-full" />
      <p v-else-if="entries.length === 0" class="mt-3 text-sm text-muted-foreground">
        {{ t('accounts.detail.noHistory') }}
      </p>
      <BalanceTimeline
        v-else
        class="mt-2"
        :entries="entries"
        :currency="account.currency"
        :editable-id="latestManualId"
        @edit="openRecord"
      />
    </section>

    <RecordBalanceSheet v-model:open="balanceOpen" :account-id="account.id" :entry="editing" />
    <TransferSheet v-model:open="transferOpen" :from-account-id="account.id" />

    <AlertDialog v-model:open="confirmDelete">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{ t('accounts.detail.deleteTitle') }}</AlertDialogTitle>
          <AlertDialogDescription>{{ t('accounts.detail.deleteBody') }}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{{ t('accounts.detail.cancel') }}</AlertDialogCancel>
          <AlertDialogAction @click="del">
            {{ t('accounts.detail.deleteConfirm') }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </section>
  <Skeleton v-else class="h-24 w-full" />
</template>
