<script setup lang="ts">
/**
 * The top bar: the way back on the left, the screen's name in the middle, the
 * screen's one action on the right — and nothing the screen did not ask for.
 *
 * The middle holds two different things at two widths, because at those two
 * widths it answers two different questions. On a phone it says which screen
 * you are on, the way a pushed screen does on iOS; the wordmark is not worth a
 * line there, and the tab links live in the pill at the bottom. A wide window
 * has room for the sections themselves, so it gets the wordmark and the tab
 * links and lets the screen's own heading name the screen.
 *
 * Both corners are a word in the accent colour and nothing else: a bar holding
 * one thing per side does not need a filled shape to say which one it is, and
 * a disc with a glyph in it turns a sentence into furniture. The way back says
 * "Back" rather than drawing a lone chevron — a chevron is a hint, and the one
 * control everybody reaches for should not have to be guessed at.
 *
 * A bar with nothing on it is not a bar. Where there is no way back, no title
 * and no action — the home screen — it is not rendered on a phone rather than
 * drawn empty. A wide window still gets it, because the tab links live in it.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { ChevronLeftIcon, Loader2Icon } from '@lucide/vue';
import { Button } from '@magermoney/ui';
import { backTarget, isCurrent, isRoot, NAV } from '@/shared/layout/nav';
import type { PageAction } from '@/shared/layout/page-bar';

const { action, title } = defineProps<{ action: PageAction | null; title: string | null }>();

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const canGoBack = computed(() => !isRoot(route.path));
/** Nothing to hold at phone width, where the wordmark and the links are hidden. */
const bare = computed(() => !canGoBack.value && !action && !title);

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
    <div class="relative mx-auto flex h-14 w-full max-w-3xl items-center gap-2 px-4 md:px-6">
      <Button
        v-if="canGoBack"
        variant="ghost"
        size="sm"
        type="button"
        class="-ms-2 min-h-11 shrink-0 gap-0.5 rounded-full ps-1 pe-3 text-[15px] font-medium text-accent-foreground hover:bg-accent/10 hover:text-accent-foreground"
        data-testid="nav-back"
        @click="goBack"
      >
        <ChevronLeftIcon :size="22" aria-hidden="true" />
        {{ t('action.back') }}
      </Button>

      <!--
        Centred on the bar, not between the corners. Only one corner is filled
        on most screens, and a title that centres itself in the leftover space
        sits visibly left of centre on one screen and right of centre on the
        next — which reads as the bar moving rather than the screen changing.
        So it is pinned to the middle and capped at the width that clears both
        corners; a long name truncates there instead of sliding under a word.
      -->
      <h2
        v-if="title"
        class="absolute left-1/2 max-w-[calc(100%-15rem)] -translate-x-1/2 truncate text-center text-[17px] font-semibold tracking-[-0.01em] md:hidden"
        data-testid="page-title"
      >
        {{ title }}
      </h2>

      <!-- The wordmark goes home, but it is not a tab: the Home tab is what says where you are. -->
      <RouterLink v-slot="{ href, navigate }" to="/" custom>
        <a
          :href="href"
          class="hidden text-base font-semibold outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring md:inline"
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

      <!--
        A running action says so where it was pressed. `aria-busy` alone is a
        promise to a screen reader that the eye never collects — the spinner is
        the same statement, made visibly, and it takes the word's place so the
        bar does not shuffle while the save is in flight.
      -->
      <Button
        v-if="action"
        variant="ghost"
        size="sm"
        type="button"
        class="-me-2 ms-auto min-h-11 shrink-0 rounded-full px-3 text-[15px] font-medium text-accent-foreground hover:bg-accent/10 hover:text-accent-foreground disabled:text-muted-foreground disabled:opacity-100"
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
  </header>
</template>
