<script setup lang="ts">
import type { ComboboxViewportProps } from 'reka-ui';
import type { HTMLAttributes } from 'vue';
import { reactiveOmit } from '@vueuse/core';
import { ComboboxViewport, useForwardProps } from 'reka-ui';
import { cn } from '../../../lib/utils';

const props = defineProps<ComboboxViewportProps & { class?: HTMLAttributes['class'] }>();

const delegatedProps = reactiveOmit(props, 'class');

const forwarded = useForwardProps(delegatedProps);
</script>

<template>
  <ComboboxViewport
    data-slot="combobox-viewport"
    v-bind="forwarded"
    :class="
      cn(
        /*
         * No padding at the top. The scrollport starts at the padding edge, so
         * a strip of padding above a sticky heading is a strip the rows scroll
         * through in full view — a line of half a currency, floating over the
         * heading it belongs under. The search field above carries the gap.
         *
         * The height it leaves for itself is the popup's, less the field: 15
         * spacing units, which is that field's 11 plus the 2 either side of it.
         */
        'no-scrollbar max-h-[min(calc(24rem---spacing(15)),calc(var(--available-height)---spacing(15)))] scroll-py-1 overflow-y-auto px-1 pb-1 data-empty:p-0',
        props.class,
      )
    "
  >
    <slot />
  </ComboboxViewport>
</template>
