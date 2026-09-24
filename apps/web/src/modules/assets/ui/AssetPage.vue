<script setup lang="ts">
/**
 * One owned thing and every opinion anyone has had about what it is worth.
 *
 * The journal is the point of this screen: a single current value hides that
 * the car was worth 30 000 last September and 28 000 the January before, and
 * that difference is the only thing that makes the number trustworthy. The
 * latest row is the value everywhere else in the app; the rest is why.
 */
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AmountLockup,
  Button,
  RouteError,
  RowGroup,
  Skeleton,
  useToast,
  type AmountLocale,
} from '@magermoney/ui';
import { errorKeyFor } from '@/shared/api/error-messages';
import { formatDay, type DateLocale } from '@/shared/dates/format';
import { usePageAction, usePageTitle } from '@/shared/layout/page-bar';
import { useAssets } from '../application/use-assets';
import { useArchiveAsset, useDeleteValuation } from '../application/use-asset-mutations';
import { useValuations } from '../application/use-valuations';
import AssetRow from './AssetRow.vue';
import ValuationSheet from './ValuationSheet.vue';

const route = useRoute();
const router = useRouter();
const { t, locale } = useI18n();
const { toast } = useToast();
const amountLocale = computed(() => locale.value as AmountLocale);
const uiLocale = computed(() => locale.value as DateLocale);

const id = computed(() => String(route.params.id));
const { assets, isLoading, isError, refetch } = useAssets();
const asset = computed(() => assets.value.find((a) => a.id === id.value));
const journal = useValuations(id);
const { remove } = useDeleteValuation(id.value);
const { archive, isPending: deleting } = useArchiveAsset();

const valuing = ref(false);
const confirmDelete = ref(false);
const missing = computed(() => !isLoading.value && !isError.value && !asset.value);

usePageTitle(() => asset.value?.name ?? t('assets.title'));
usePageAction(() => ({
  label: t('assets.revalue'),
  ariaLabel: t('assets.revalueNamed', { name: asset.value?.name ?? '' }),
  onSelect: () => (valuing.value = true),
  disabled: !asset.value,
  testid: 'asset-revalue',
}));

/**
 * The move against what it cost. Both amounts are in the asset's own currency,
 * so no rate is involved and the figure is exact.
 */
const sincePurchase = computed(() => {
  const a = asset.value;
  if (!a?.value || !a.purchasePrice) return null;
  const diff = a.value.subtract(a.purchasePrice);
  if (diff.isErr()) return null;
  const moved = diff.value;
  return t(moved.isNegative() ? 'assets.lostSince' : 'assets.gainedSince', {
    amount: moved.isNegative() ? moved.multiply(-1).round().toString() : moved.round().toString(),
    code: a.value.currency.code,
    price: a.purchasePrice.round().toString(),
  });
});

/**
 * Deleting is archiving underneath: the asset and its journal keep their rows,
 * and every list and total leaves them out from then on.
 */
async function deleteAsset() {
  if (!asset.value) return;
  try {
    await archive(asset.value.id);
    toast.success(t('assets.deleted'));
    await router.replace({ name: 'savings', query: { tab: 'assets' } });
  } catch (e) {
    toast.error(t(errorKeyFor(e, 'assets.error.title')));
  }
}

async function dropValuation(valuationId: string) {
  try {
    await remove(valuationId);
  } catch (e) {
    toast.error(t(errorKeyFor(e, 'assets.error.title')));
  }
}
</script>

<template>
  <section class="flex flex-col gap-5 pb-8">
    <h1 class="sr-only text-2xl font-semibold tracking-[-0.01em] md:not-sr-only">
      {{ asset?.name ?? t('assets.title') }}
    </h1>

    <div v-if="isError" data-testid="asset-error">
      <RouteError
        :title="t('assets.error.title')"
        :action-label="t('assets.error.retry')"
        @retry="refetch"
      />
    </div>

    <Skeleton v-else-if="isLoading" class="h-32 w-full rounded-xl" />

    <p v-else-if="missing" class="text-muted-foreground text-sm" data-testid="asset-missing">
      {{ t('assets.form.missing') }}
    </p>

    <template v-else-if="asset">
      <div class="bg-surface shadow-card rounded-xl">
        <AssetRow :asset="asset" />
      </div>

      <!--
        What it has done since it was bought. Only shown when both numbers
        exist: a change against a price nobody recorded is not a change.
      -->
      <p
        v-if="sincePurchase"
        class="text-muted-foreground px-1 text-sm"
        data-testid="asset-since-purchase"
      >
        {{ sincePurchase }}
      </p>

      <div class="flex gap-3">
        <Button
          class="min-h-11 rounded-xl px-4"
          data-testid="asset-revalue-open"
          @click="valuing = true"
        >
          {{ t('assets.revalue') }}
        </Button>
        <Button as-child variant="ghost" class="min-h-11 rounded-xl px-4">
          <RouterLink :to="{ name: 'asset-edit', params: { id } }" data-testid="asset-edit-link">
            {{ t('assets.edit') }}
          </RouterLink>
        </Button>
      </div>

      <section class="flex flex-col gap-2">
        <h2 class="px-1 text-sm font-medium">
          {{ t('assets.journal') }}
        </h2>

        <Skeleton v-if="journal.isLoading.value" class="h-24 w-full rounded-xl" />

        <p
          v-else-if="journal.valuations.value.length === 0"
          class="text-muted-foreground px-1 text-sm"
          data-testid="asset-journal-empty"
        >
          {{ t('assets.journalEmpty') }}
        </p>

        <RowGroup v-else :aria-label="t('assets.journal')">
          <li v-for="v in journal.valuations.value" :key="v.id" class="min-w-0">
            <div class="flex min-h-11 items-center justify-between gap-3 px-4 py-3">
              <span class="text-muted-foreground text-sm">
                {{ formatDay(v.valuedOn, uiLocale) }}
              </span>
              <div class="flex shrink-0 items-center gap-2">
                <AmountLockup
                  :amount="v.value"
                  :code="asset.value?.currency.code ?? ''"
                  :scale="asset.value?.currency.scale ?? 2"
                  :locale="amountLocale"
                  class="text-sm"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  class="min-h-11 px-2"
                  :data-testid="`valuation-remove-${v.id}`"
                  :aria-label="
                    t('assets.removeValuation', { date: formatDay(v.valuedOn, uiLocale) })
                  "
                  @click="dropValuation(v.id)"
                >
                  {{ t('assets.remove') }}
                </Button>
              </div>
            </div>
          </li>
        </RowGroup>
      </section>

      <div class="pt-2">
        <Button
          variant="destructive"
          class="min-h-11 rounded-xl px-4"
          :disabled="deleting"
          data-testid="asset-delete"
          @click="confirmDelete = true"
        >
          {{ t('assets.delete') }}
        </Button>
      </div>

      <AlertDialog v-model:open="confirmDelete">
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{{ t('assets.deleteTitle', { name: asset.name }) }}</AlertDialogTitle>
            <AlertDialogDescription>{{ t('assets.deleteBody') }}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="asset-delete-cancel">
              {{ t('assets.cancel') }}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              :disabled="deleting"
              data-testid="asset-delete-confirm"
              @click="deleteAsset"
            >
              {{ t('assets.delete') }}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ValuationSheet v-model:open="valuing" :asset-id="asset.id" />
    </template>
  </section>
</template>
