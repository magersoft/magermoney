<script setup lang="ts">
/**
 * An account, as a card — laid out the way a bank card is (reference slide 12):
 * the issuing mark and the scheme at the top, the balance in the middle, the
 * chip and the card's identity along the foot.
 *
 * Two of the reference's pieces of furniture are ours rather than a bank's. The
 * scheme logo is the scheme's only when the account *is* a payment card;
 * everything else — a deposit, a wallet, cash — puts the currency mark there,
 * because what an account is held in is the nearest thing it has to an issuer.
 * And the masked number is a masked number only where four digits exist: we
 * never hold more of a card than that, and for everything else the foot says
 * where the money is kept instead.
 *
 * What the card says is ordered by what a covered card still has to answer. In
 * the stack every card but the last is overlapped from below, so the name, the
 * mark and the balance sit in the band that stays visible, and the foot — the
 * identity line — is the part that may be covered. Reading a stack is «which
 * account, how much»; reading one card is everything.
 *
 * All the type is ink. A balance is never coloured (docs/design/direction.md),
 * and a second, quieter tone would not clear AA on the tint anyway. The sheen
 * (`card-gloss`) lies over the fill and under the ink, and is drawn rather than
 * animated, so it has nothing to take away under reduced motion.
 */
import { computed } from 'vue';
import { StarIcon } from '@lucide/vue';
import { Primitive, type PrimitiveProps } from 'reka-ui';
import type { HTMLAttributes } from 'vue';
import { cn } from '../../lib/utils';
import AmountLockup from '../amount-lockup/AmountLockup.vue';
import CurrencyIcon from '../currency-icon/CurrencyIcon.vue';
import type { AmountLocale } from '../amount-lockup/format-amount';
import CardBrandMark from './CardBrandMark.vue';
import { cardBrand } from './card-brand';
import { cardTintStyle } from './colorways';
import type { AccountCardItem } from './types';

interface Props extends PrimitiveProps {
  account: AccountCardItem;
  /** The base currency. An account held in anything else gets marked. */
  baseCode?: string;
  locale?: AmountLocale;
  /** `sm` is the strip's tile, `md` the stack's wallet card. */
  size?: 'sm' | 'md';
  class?: HTMLAttributes['class'];
}

const props = withDefaults(defineProps<Props>(), {
  as: 'a',
  baseCode: undefined,
  locale: 'en',
  size: 'md',
  class: '',
});

/*
 * The multicurrency fact the reference has no answer for: money that is not in
 * the currency you count in. The code in mono caps is the mark, and it is real
 * text, so a screen reader reaches it along with the balance.
 */
const foreign = computed(
  () =>
    props.baseCode !== undefined &&
    props.account.code.toUpperCase() !== props.baseCode.toUpperCase(),
);

/** The scheme, when the account is a payment card and the network names one. */
const brand = computed(() => (props.account.isCard ? cardBrand(props.account.network) : null));

/*
 * What the foot says. A payment card says what is embossed on one — the digits
 * it is known by, and when it runs out. Anything else says where it is kept,
 * which is the only identity it has: we store no account numbers.
 */
const masked = computed(() => (props.account.last4 ? `•• ${props.account.last4}` : null));
const footing = computed(() =>
  props.account.isCard ? masked.value : (props.account.reference ?? null),
);

/*
 * One destination, spelled the way the element it renders as expects it: an
 * anchor takes `href`, a router link takes `to`. A screen therefore swaps `as`
 * and nothing else, and cannot end up with a card that leads nowhere.
 */
const linkAttrs = computed(() => {
  if (!props.account.href) return {};
  return props.as === 'a' ? { href: props.account.href } : { to: props.account.href };
});
</script>

<template>
  <Primitive
    data-slot="account-card"
    :as="as"
    :as-child="asChild"
    :data-foreign="foreign || undefined"
    :data-colorway="props.account.colorway ?? undefined"
    :style="cardTintStyle(props.account.code, props.account.colorway)"
    v-bind="linkAttrs"
    :class="
      cn(
        'bg-currency-tint text-ink shadow-card relative flex flex-col rounded-xl p-4',
        /*
         * The edge the dark theme needs and the light one does not: with no
         * shadow on a dark canvas, a hairline of ink is what catches the top of
         * a card against whatever it is lying on. In light the token is
         * transparent and this draws nothing.
         */
        'border-card-edge border',
        /*
         * The sheen is painted on the element itself rather than in a layer of
         * its own: `background-image` sits above `background-color` and below
         * every child, which is exactly where light on a surface belongs, and
         * it saves an overlay that would have to be excluded from the a11y tree
         * and from pointer events.
         */
        'card-gloss overflow-hidden bg-clip-padding',
        'duration-fast ease-out-quart outline-offset-2 transition-transform',
        'hover:-translate-y-0.5 focus-visible:-translate-y-0.5',
        'focus-visible:outline-ring focus-visible:outline-2 motion-reduce:transition-none',
        /*
         * Tall enough for the foot to sit at a card's bottom edge rather than
         * under the balance, and no taller: a card sized to a real one's
         * proportions opens a void in its middle, because the reference fills
         * that middle with a balance we keep in the top band (see above).
         */
        props.size === 'sm' ? 'min-h-28 gap-1.5' : 'min-h-36 gap-2',
        props.class,
      )
    "
  >
    <span class="flex items-start justify-between gap-2">
      <span class="min-w-0 flex-1 truncate text-sm font-medium">{{ props.account.name }}</span>
      <!--
        The star sits with the furniture rather than the name, so a long name
        still gets the whole row to truncate in, and it is centred against the
        mark rather than the text so the two read as one group. Filled and in
        full ink, the same star the account's own screen is toggled with: a
        quieter tone would not clear the 3:1 a graphic owes (WCAG 1.4.11), and
        at 14px the size is the quiet.
      -->
      <span class="flex shrink-0 items-center gap-1.5">
        <StarIcon
          v-if="props.account.pinned"
          data-slot="account-card-pinned"
          role="img"
          class="fill-current"
          :aria-label="props.account.pinnedLabel"
          :size="props.size === 'sm' ? 14 : 16"
        />
        <!--
          The corner a bank puts its scheme in. A payment card whose scheme we
          recognise gets the scheme; every other account gets the mark of what
          it holds, which is the closest thing it has to one. Both are silent —
          the code is announced by the foreign badge, and the scheme is spelled
          out in the foot for anyone listening.
        -->
        <CardBrandMark v-if="brand" :brand="brand" :size="props.size === 'sm' ? 22 : 28" />
        <span v-else aria-hidden="true">
          <CurrencyIcon
            :code="props.account.code"
            :kind="props.account.kind"
            :country="props.account.country"
            :size="props.size === 'sm' ? 20 : 24"
          />
        </span>
      </span>
    </span>

    <span class="flex items-baseline justify-between gap-2">
      <AmountLockup
        :amount="props.account.amount"
        :code="props.account.code"
        :scale="props.account.scale ?? 2"
        :locale="props.locale"
        :class="props.size === 'sm' ? 'text-base' : 'text-lg'"
      />
      <span
        v-if="foreign"
        data-slot="account-card-foreign"
        class="bg-ink/10 text-2xs shrink-0 rounded-full px-2 py-0.5 font-mono tracking-[0.08em] uppercase"
        >{{ props.account.code.toUpperCase() }}</span
      >
    </span>

    <!--
      The foot. `mt-auto` pushes it to the bottom edge whatever the card's
      height, which is what makes the chip and the digits sit where they sit on
      a real card rather than floating under the balance.
    -->
    <span class="mt-auto flex items-end justify-between gap-2 pt-2">
      <!--
        The chip: the one piece of a bank card that is a shape rather than a
        word, and the fastest signal that this rectangle is meant to be a card.
        Drawn in ink at a low opacity, so it belongs to the surface rather than
        sitting on it, and hidden from the a11y tree — it says nothing.
      -->
      <svg
        data-slot="account-card-chip"
        :width="props.size === 'sm' ? 22 : 28"
        :height="props.size === 'sm' ? 17 : 22"
        viewBox="0 0 28 22"
        aria-hidden="true"
        focusable="false"
        class="shrink-0"
      >
        <!--
          A filled pad with its contacts cut out of it, rather than an outline:
          an outlined grid reads as a table icon, and the thing that makes a
          chip a chip is that it is a solid gold pad with seams.
        -->
        <rect x="0" y="0" width="28" height="22" rx="3.5" fill="currentColor" fill-opacity="0.38" />
        <path
          d="M0 7.5h28M0 14.5h28M10 0v22M18.5 0v22"
          stroke="currentColor"
          stroke-opacity="0.5"
          stroke-width="1.25"
        />
        <rect x="10" y="7.5" width="8.5" height="7" fill="currentColor" fill-opacity="0.22" />
      </svg>

      <span
        v-if="footing"
        data-slot="account-card-footing"
        class="text-2xs min-w-0 truncate font-mono tracking-[0.12em] tabular-nums"
        >{{ footing }}</span
      >
      <!--
        The expiry keeps its own slot at the right edge rather than joining the
        line above: on a card these two are read separately, and a date that
        truncated with the digits would be neither.

        It is the first thing to go on the strip's narrow tile, where the two of
        them together push the digits into an ellipsis. A truncated date is a
        date you still recognise; «•• 23…» is a number that has stopped being
        one, so the date yields and the digits stay whole.
      -->
      <span
        v-if="props.size === 'md' && props.account.isCard && props.account.expires"
        data-slot="account-card-expires"
        class="text-2xs shrink-0 font-mono tracking-[0.12em] tabular-nums opacity-70"
        >{{ props.account.expires }}</span
      >
    </span>
  </Primitive>
</template>
