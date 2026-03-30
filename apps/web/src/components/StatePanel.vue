<script setup lang="ts">
defineProps<{
  turn: number
  stats: Record<string, number>
}>()
</script>

<template>
  <section class="rounded-lg border border-stone-200 bg-[var(--panel)] p-4 shadow-sm">
    <h2 class="mb-2 text-sm font-semibold tracking-wide text-stone-600">数值状态</h2>
    <p class="mb-3 text-sm">当前回合：{{ turn }}</p>
    <ul class="grid grid-cols-2 gap-2 text-sm">
      <li
        v-for="(value, key) in stats"
        :key="key"
        class="rounded border border-stone-200 bg-white px-2 py-1"
      >
        <span class="font-medium">{{ key }}</span>
        <span class="float-right">{{ value }}</span>
      </li>
    </ul>
  </section>
</template>
