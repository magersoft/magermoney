<script setup lang="ts">
/**
 * The top bar, in the reference's scheme: navigation on the left, the screen's
 * one action on the right, and nothing in between that the screen did not ask
 * for.
 *
 * The left is a single place with two readings. On a screen you arrived at
 * from somewhere else it is the way back; on a tab's own screen there is no
 * back, so the wordmark takes the place instead of leaving a hole. A wide
 * window has room for the sections themselves, so the wordmark and the tab
 * links sit in the middle there — the phone reaches them through the pill at
 * the bottom.
 *
 * The right is the screen's, through `page-action.ts`. The bar renders what it
 * was handed and never invents an action of its own. It is a word in the
 * accent colour and nothing else: a bar holding one action does not need a
 * filled shape to say which one it is, and a disc with a glyph in it turns a
 * sentence into furniture.
 *
 * A bar with nothing on it is not a bar. On the home screen there is no way
 * back, no action, and the currency switch belongs to the screen itself — so
 * on a phone the bar is not rendered at all rather than drawn empty. A wide
 * window still gets it, because there the tab links live in it.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { ChevronLeftIcon, Loader2Icon } from '@lucide/vue';
import { Button } from '@magermoney/ui';
import { backTarget, isCurrent, isRoot, NAV } from '@/shared/layout/nav';
import type { PageAction } from '@/shared/layout/page-action';

const { action, showCurrency } = defineProps<{
  action: PageAction | null;
  /** Home carries its own switch; everywhere else the bar carries it. */
  showCurrency: boolean;
}>();

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const canGoBack = computed(() => !isRoot(route.path));

/** Nothing on the left but the wordmark, nothing on the right at all. */
const bare = computed(() => !canGoBack.value && !action && !showCurrency);

/**
 * `router.back()` needs somewhere to go back to. A screen opened from a link,
 * a notification or a reloaded tab has nothing behind it, and stepping into
 * whatever the browser was showing before this app is not "back" — so those
 * land on the tab that owns the screen instead.
 */
function goBack(): void {
  if (router.options.history.state.back) router.back();
  else void router.push(backTarget(route.path));
}
</script>

<template>
  <header
    class="sticky top-0 z-20 border-b border-border bg-background"
    :class="bare ? 'hidden md:block' : ''"
    style="padding-top: env(safe-area-inset-top)"
  >
    <div class="mx-auto flex h-14 w-full max-w-3xl items-center gap-3 px-4 md:px-6">
      <Button
        v-if="canGoBack"
        variant="ghost"
        size="icon"
        type="button"
        class="-ms-2 size-11 shrink-0"
        :aria-label="t('a11y.back')"
        data-testid="nav-back"
        @click="goBack"
      >
        <ChevronLeftIcon :size="22" aria-hidden="true" />
      </Button>

      <!--
        The wordmark goes home, but it is not a tab: the Home tab is what says
        where you are. It steps aside on a phone once there is a back button —
        two things competing for the left corner is how a bar stops reading as
        a direction.
      -->
      <RouterLink v-slot="{ href, navigate }" to="/" custom>
        <a
          :href="href"
          class="text-base font-semibold outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
          :class="canGoBack ? 'hidden md:inline' : ''"
          @click="navigate"
        >
          {{ t('app.name') }}
        </a>
      </RouterLink>

      <nav class="hidden gap-4 md:flex" :aria-label="t('a11y.primaryNav')">
        <RouterLink
          v-for="item in NAV"
          :key="item.to"
          v-slot="{ href, navigate }"
          :to="item.to"
          custom
        >
          <a
            :href="href"
            :aria-current="isCurrent(item, route.path) ? 'page' : undefined"
            class="text-sm outline-offset-4 transition-colors duration-fast focus-visible:outline-2 focus-visible:outline-ring"
            :class="
              isCurrent(item, route.path)
                ? 'text-accent-foreground'
                : 'text-muted-foreground hover:text-foreground'
            "
            @click="navigate"
          >
            {{ t(item.label) }}
          </a>
        </RouterLink>
      </nav>

      <div class="ms-auto flex shrink-0 items-center gap-1">
        <slot v-if="showCurrency" name="currency" />

        <!--
          A running action says so where it was pressed. `aria-busy` alone is a
          promise to a screen reader that the eye never collects — the spinner
          is the same statement, made visibly, and it takes the word's place so
          the bar does not shuffle while the save is in flight.
        -->
        <Button
          v-if="action"
          variant="ghost"
          size="sm"
          type="button"
          class="-me-2 min-h-11 rounded-full px-3 text-[15px] font-medium text-accent-foreground hover:bg-accent/10 hover:text-accent-foreground disabled:text-muted-foreground disabled:opacity-100"
          :aria-label="action.ariaLabel"
          :disabled="action.disabled || action.pending"
          :aria-busy="action.pending ? 'true' : undefined"
          :data-testid="action.testid ?? 'page-action'"
          @click="action.onSelect"
        >
          <Loader2Icon v-if="action.pending" :size="18" class="animate-spin" aria-hidden="true" />
          <template v-else>
            {{ action.label }}
          </template>
        </Button>
      </div>
    </div>
  </header>
</template>
