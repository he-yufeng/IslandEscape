<script setup lang="ts">
type SaveItem = {
  id: string
  label: string
  turn: number
}

defineProps<{
  items: SaveItem[]
}>()
</script>

<template>
  <section class="rounded-lg border border-stone-200 bg-[var(--panel)] p-4 shadow-sm">
    <h2 class="mb-3 text-sm font-semibold tracking-wide text-stone-600">存档列表</h2>
    <ul class="space-y-2 text-sm text-stone-700">
      <li
        v-for="item in items"
        :key="item.id"
        class="rounded border border-stone-200 bg-white px-3 py-2"
      >
        <p class="font-medium">{{ item.label }}</p>
        <p class="text-xs text-stone-500">回合 {{ item.turn }} · {{ item.id }}</p>
      </li>
    </ul>
  </section>
</template>
