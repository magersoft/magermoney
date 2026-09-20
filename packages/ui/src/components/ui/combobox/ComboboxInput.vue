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
    class="border-border flex h-9 items-center gap-2 border-b px-3"
  >
    <SearchIcon class="size-4 shrink-0 opacity-50" />
    <ComboboxInput
      data-slot="combobox-input"
      :class="
        cn(
          'placeholder:text-muted-foreground flex-1 bg-transparent text-sm outline-hidden disabled:cursor-not-allowed disabled:opacity-50',
          props.class,
        )
      "
      v-bind="{ ...$attrs, ...forwarded }"
    />
  </div>
</template>
