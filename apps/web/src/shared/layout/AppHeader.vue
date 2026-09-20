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
 * was handed and never invents an action of its own.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { ChevronLeftIcon, Loader2Icon } from '@lucide/vue';
import { Button } from '@magermoney/ui';
import { backTarget, isCurrent, isRoot, NAV } from '@/shared/layout/nav';
import type { PageAction } from '@/shared/layout/page-action';

const { action } = defineProps<{ action: PageAction | null }>();

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const canGoBack = computed(() => !isRoot(route.path));

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

      <div class="ms-auto flex shrink-0 items-center gap-2">
        <slot name="currency" />

        <!--
          One button, two shapes: a glyph where the action is common enough to
          be recognised as one (adding), the words themselves where it is not.
          Either way the label is what a screen reader reads out, so the shapes
          never differ in what they say.

          A running action says so where it was pressed. `aria-busy` alone is a
          promise to a screen reader that the eye never collects — the spinner
          is the same statement, made visibly, and it takes the glyph's place
          rather than pushing the words around.
        -->
        <Button
          v-if="action"
          :variant="action.icon ? 'outline' : 'default'"
          :size="action.icon ? 'icon' : 'sm'"
          type="button"
          :class="action.icon ? 'size-11 rounded-full' : '-me-1 min-h-11 rounded-full px-4'"
          :aria-label="action.icon ? action.label : undefined"
          :title="action.icon ? action.label : undefined"
          :disabled="action.disabled || action.pending"
          :aria-busy="action.pending ? 'true' : undefined"
          :data-testid="action.testid ?? 'page-action'"
          @click="action.onSelect"
        >
          <Loader2Icon v-if="action.pending" :size="20" class="animate-spin" aria-hidden="true" />
          <component :is="action.icon" v-else-if="action.icon" :size="20" aria-hidden="true" />
          <template v-if="!action.icon">
            {{ action.label }}
          </template>
        </Button>
      </div>
    </div>
  </header>
</template>
