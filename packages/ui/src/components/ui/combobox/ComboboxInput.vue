<script setup lang="ts">
import type { ComboboxInputEmits, ComboboxInputProps } from 'reka-ui';

import type { HTMLAttributes } from 'vue';
import { SearchIcon } from '@lucide/vue';
import { reactiveOmit } from '@vueuse/core';
import { ComboboxInput, useForwardPropsEmits } from 'reka-ui';
import { cn } from '../../../lib/utils';

defineOptions({
  inheritAttrs: false,
});

const props = defineProps<
  ComboboxInputProps & {
    class?: HTMLAttributes['class'];
  }
>();

const emits = defineEmits<ComboboxInputEmits>();

const delegatedProps = reactiveOmit(props, 'class');

const forwarded = useForwardPropsEmits(delegatedProps, emits);
</script>

<template>
  <!--
    The upstream component wraps this in `input-group`, which this design system
    does not carry. The wrapper is the same two things without it: the search
    mark, and a rule under the field that separates it from the list.
  -->
  <div
    data-slot="combobox-input-wrapper"
    class="border-border flex h-12 items-center gap-2.5 border-b px-3 md:h-11"
  >
    <SearchIcon class="size-4 shrink-0 opacity-50" />
    <!--
      16px on a phone, and no smaller: Safari zooms the whole page into any
      field it has to magnify to read, and coming back out of that zoom is
      manual. The desktop size is the one the rest of the popup is set in.
    -->
    <ComboboxInput
      data-slot="combobox-input"
      :class="
        cn(
          'placeholder:text-muted-foreground h-full flex-1 bg-transparent text-base outline-hidden disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
          props.class,
        )
      "
      v-bind="{ ...$attrs, ...forwarded }"
    />
  </div>
</template>
