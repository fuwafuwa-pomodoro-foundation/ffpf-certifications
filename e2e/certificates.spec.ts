import { expect, test } from '@playwright/test'

const certificate = {
  id: '5f09a85c-a353-4cf8-9f26-4d761cb12558',
  title: 'YouTubeでアーキテクチャ動画を見ました',
  recipient: 'Fuwa Fuwa Taro',
  description: '動画を最後まで視聴しました。',
  issuedAt: '2026-08-12',
  createdAt: '2026-08-12T10:00:00.000Z',
}

test('共有用OGPメタデータを提供する', async ({ page }) => {
  await page.goto('/')

  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
    'content',
    'FFPF Certifications | あらゆる達成に、連邦公認の証を。',
  )
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    'content',
    'https://ffpf-certifications.sparklingstadt.workers.dev/og-image.png',
  )
  await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute('content', '1200')
  await expect(page.locator('meta[property="og:image:height"]')).toHaveAttribute('content', '630')
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image')
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://ffpf-certifications.sparklingstadt.workers.dev/',
  )
})

test('D1から取得した認定証を一覧表示する', async ({ page }) => {
  await page.route('**/api/certificates', async (route) => {
    await route.fulfill({ json: { certificates: [certificate] } })
  })

  await page.goto('/')

  await expect(page.getByRole('heading', { name: certificate.title })).toBeVisible()
  await expect(page.getByText(certificate.recipient)).toBeVisible()
  await expect(page.getByText('登録数 1')).toBeVisible()
})

test('認定証の入力を検証し、登録後に一覧へ移動する', async ({ page }) => {
  let certificates: typeof certificate[] = []
  await page.route('**/api/certificates', async (route) => {
    if (route.request().method() === 'POST') {
      certificates = [certificate]
      await route.fulfill({ status: 201, json: certificate })
      return
    }
    await route.fulfill({ json: { certificates } })
  })

  await page.goto('/certificates/new')
  await page.getByRole('button', { name: '連邦に登録する' }).click()
  await expect(page.getByText('認定名を入力してください')).toBeVisible()

  await page.getByLabel('認定名').fill('YouTubeでアーキテクチャ動画を見ました')
  await page.getByLabel('認定者名').fill('Fuwa Fuwa Taro')
  await page.getByLabel('認定内容').fill('動画を最後まで視聴しました。')
  await page.getByRole('button', { name: '連邦に登録する' }).click()

  await expect(page).toHaveURL('/')
  await expect(page.getByRole('heading', { name: certificate.title })).toBeVisible()
})
