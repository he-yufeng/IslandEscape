import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { describe, expect, it } from 'vitest'

import App from '../App.vue'

describe('App', () => {
  it('renders the Island Escape title screen', () => {
    const wrapper = mount(App, {
      global: {
        plugins: [createPinia()],
      },
    })

    expect(wrapper.get('h1').text()).toBe('ISLAND ESCAPE')
    expect(wrapper.text()).toContain('A survival trading game with AI agents')
    expect(wrapper.get('button').text()).toBe('NEW GAME')
    expect(wrapper.text()).toContain('How to play')
  })
})
