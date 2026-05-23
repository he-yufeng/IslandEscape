import { createRouter, createWebHistory } from 'vue-router'
import { h } from 'vue'

const EmptyRoute = {
  render: () => h('span'),
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: EmptyRoute,
    },
  ],
})

export default router
