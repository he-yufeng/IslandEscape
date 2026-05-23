import { test, expect } from '@playwright/test'

test('shows the Island Escape title screen', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'ISLAND ESCAPE' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'NEW GAME' })).toBeVisible()
  await expect(page.getByText('How to play')).toBeVisible()
})
