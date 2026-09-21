<script setup lang="ts">
/**
 * The phone's navigation: a pill that floats clear of the screen's edges, with
 * the "+" rising out of its middle (the reference's slides 10 and 14).
 *
 * The pill is glass: content scrolls under it, blurred and still coloured, so
 * the bar reads as a layer over the screen rather than the line the screen is
 * cut off at. The material is `glass-panel` from the design system, which is
 * also where its legibility is proved — a translucent panel is read against
 * whatever is passing behind it, so the fill's alpha is a contrast decision
 * and belongs next to the tokens, not here.
 *
 * That proof is why the tabs are set in ink rather than in the quieter roles
 * chrome usually takes: over a saturated account card, nothing dimmer than ink
 * survives the composite at AA. The current tab is marked by an opaque capsule
 * instead of by a tint, which puts the one coloured thing in the bar back on a
 * surface the palette already proves.
 *
 * The focus ring follows from the same fact and is the one place in the app
 * that does not take `outline-ring`: the accent reads at 2:1 against the glass
 * over a saturated card, under the 3:1 WCAG 1.4.11 asks of an indicator. It is
 * drawn in `currentColor` instead, inset, because whatever a control's own
 * mark is set in is by construction the one colour already proven against the
 * surface that control sits on — ink on the glass, the accent on the capsule,
 * the disc's own foreground on the disc.
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
import { isCurrent, PILL_NAV } from '@/shared/layout/nav';

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
      data-testid="nav-pill"
      class="glass-panel mx-auto flex h-16 max-w-sm items-center rounded-full px-2"
    >
      <template v-for="(item, i) in PILL_NAV" :key="item.to">
        <!--
          The "+" sits in the middle of the row rather than on top of it: a tab
          under a 56px disc is a tab nobody can hit. It rises out of the pill by
          translation, not margin, so the four tabs keep the width they had and
          the press can scale the same disc without fighting the layout.

          Index 2 of four puts two tabs on each side. `PILL_NAV` is what keeps
          that true: a fifth tab here would push the disc off centre.
        -->
        <button
          v-if="i === 2"
          type="button"
          data-testid="quick-add"
          :aria-label="t('quick.open')"
          class="bg-ink text-background shadow-card duration-fast ease-out-quart mx-1 grid size-14 shrink-0 -translate-y-4 place-items-center rounded-full -outline-offset-2 transition-transform active:scale-95 focus-visible:outline-2 focus-visible:outline-current motion-reduce:transition-none dark:bg-primary dark:text-primary-foreground"
          @click="emit('quick')"
        >
          <PlusIcon class="size-6" aria-hidden="true" />
        </button>

        <RouterLink v-slot="{ href, navigate }" :to="item.to" custom>
          <a
            :href="href"
            :data-testid="`tab-${item.key}`"
            :aria-current="isCurrent(item, route.path) ? 'page' : undefined"
            class="duration-fast ease-out-quart -outline-offset-2 flex min-h-11 flex-1 flex-col items-center justify-center gap-1 rounded-full text-2xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-current"
            :class="
              /*
               * `shadow-card` earns its place only in light, and that is
               * exactly where it is needed: over a pale card the white
               * capsule and the light glass around it are nearly the same
               * value, and the lift is what separates them. In dark the
               * token draws nothing, because there the capsule is already
               * lighter than the glass over anything.
               */
              isCurrent(item, route.path)
                ? 'bg-surface-raised shadow-card text-accent-foreground'
                : 'text-ink'
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
