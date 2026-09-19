<script setup lang="ts">
/**
 * The phone's navigation: a pill that floats clear of the screen's edges, with
 * the "+" rising out of its middle (the reference's slides 10 and 14).
 *
 * The "+" is a section, not a button parked on a screen — writing something
 * down is the thing this app is opened for, so it is reachable from every
 * screen and never more than one thumb away. It raises `quick` rather than
 * owning a sheet: the quick actions live once, in the composition root.
 *
 * Wide windows use the bar in the header instead; this is `md:hidden`.
 */
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import { PlusIcon } from '@lucide/vue';
import { isCurrent, NAV } from '@/shared/layout/nav';

const emit = defineEmits<{ quick: [] }>();

const { t } = useI18n();
const route = useRoute();
</script>

<template>
  <nav
    class="fixed inset-x-0 bottom-0 z-20 px-4 md:hidden"
    style="padding-bottom: calc(env(safe-area-inset-bottom) + 0.75rem)"
    :aria-label="t('a11y.primaryNav')"
  >
    <div
      class="bg-surface-raised shadow-card mx-auto flex h-16 max-w-sm items-center rounded-full px-2"
    >
      <template v-for="(item, i) in NAV" :key="item.to">
        <!--
          The "+" sits in the middle of the row rather than on top of it: a tab
          under a 56px disc is a tab nobody can hit. It rises out of the pill by
          translation, not margin, so the four tabs keep the width they had and
          the press can scale the same disc without fighting the layout.
        -->
        <button
          v-if="i === 2"
          type="button"
          data-testid="quick-add"
          :aria-label="t('quick.open')"
          class="bg-ink text-background shadow-card duration-fast ease-out-quart mx-1 grid size-14 shrink-0 -translate-y-4 place-items-center rounded-full outline-offset-2 transition-transform active:scale-95 focus-visible:outline-2 focus-visible:outline-ring motion-reduce:transition-none dark:bg-primary dark:text-primary-foreground"
          @click="emit('quick')"
        >
          <PlusIcon class="size-6" aria-hidden="true" />
        </button>

        <RouterLink v-slot="{ href, navigate }" :to="item.to" custom>
          <a
            :href="href"
            :data-testid="`tab-${item.key}`"
            :aria-current="isCurrent(item, route.path) ? 'page' : undefined"
            class="duration-fast ease-out-quart -outline-offset-2 flex min-h-11 flex-1 flex-col items-center justify-center gap-1 rounded-full text-2xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring"
            :class="
              isCurrent(item, route.path) ? 'text-accent-foreground' : 'text-muted-foreground'
            "
            @click="navigate"
          >
            <component :is="item.icon" class="size-5" aria-hidden="true" />
            {{ t(item.label) }}
          </a>
        </RouterLink>
      </template>
    </div>
  </nav>
</template>
