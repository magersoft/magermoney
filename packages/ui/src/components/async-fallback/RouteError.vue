<script setup lang="ts">
/**
 * What a routed screen shows when its chunk did not arrive — after a deploy the
 * old file is gone. It says so and offers the one thing that helps; what "retry"
 * means (a reload) is the app's business, not the design system's.
 */
import { Button } from '../ui/button';

defineProps<{ title: string; actionLabel: string }>();
const emit = defineEmits<{ retry: [] }>();
</script>

<template>
  <div role="alert" data-slot="route-error" class="mt-10 text-center">
    <p class="text-lg font-semibold">
      {{ title }}
    </p>
    <Button
      type="button"
      class="mt-4 min-h-9 pointer-coarse:min-h-11"
      data-testid="route-reload"
      @click="emit('retry')"
    >
      {{ actionLabel }}
    </Button>
  </div>
</template>
