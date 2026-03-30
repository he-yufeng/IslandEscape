<script setup lang="ts">
defineProps<{
  logs: string[]
}>()
</script>

<template>
  <section class="rounded-lg border border-stone-200 bg-[var(--panel)] p-4 shadow-sm">
    <h2 class="mb-3 text-sm font-semibold tracking-wide text-stone-600">文本日志流</h2>
    <ul class="space-y-2 text-sm leading-relaxed text-stone-700">
      <li v-for="(line, idx) in logs" :key="idx" class="rounded bg-stone-100/80 px-2 py-1">
        {{ line }}
      </li>
    </ul>
  </section>
</template>
