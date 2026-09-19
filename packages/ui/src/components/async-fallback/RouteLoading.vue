<script setup lang="ts">
/** What a routed screen shows while its chunk is on the way: the shape of a page, and a word for a screen reader. */
import { Skeleton } from '../ui/skeleton';

defineProps<{ label: string }>();
</script>

<template>
  <div role="status" aria-live="polite" data-slot="route-loading" class="space-y-4 pt-2">
    <span class="sr-only">{{ label }}</span>
    <Skeleton class="h-8 w-40" />
    <Skeleton class="h-12 w-64" />
    <Skeleton class="h-11 w-full" />
    <Skeleton class="h-11 w-full" />
  </div>
</template>
