import { expect, test } from '@playwright/test'

test('認定証の入力を検証して登録できる', async ({ page }) => {
  await page.goto('/certificates/new')
  await page.getByRole('button', { name: '連邦に登録する' }).click()
  await expect(page.getByText('認定名を入力してください')).toBeVisible()

  await page.getByLabel('認定名').fill('YouTubeでアーキテクチャ動画を見ました')
  await page.getByLabel('認定者名').fill('Fuwa Fuwa Taro')
  await page.getByLabel('認定内容').fill('動画を最後まで視聴しました。')
  await page.getByRole('button', { name: '連邦に登録する' }).click()

  await expect(page.getByRole('status')).toHaveText('認定証を登録しました。')
})
