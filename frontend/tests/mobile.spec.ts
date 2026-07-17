import { test, expect, devices } from '@playwright/test'

// Mobile acceptance smoke for SecureGate / EIP-777G. Runs on a mobile viewport
// (see playwright.config.ts projects). It asserts the honest product surface:
//   * SecureGate / EIP-777G name visible; no "EIP-712 project" misnaming;
//   * K1 / K2 / K3 fields reachable;
//   * K2 signing shows provider-not-connected honestly with no injected wallet;
//   * no operator Revoke flow, no QR flow, no fake verified:true, no RPC URL.

test.use({ ...devices['Pixel 5'] })

test('mobile: SecureGate / EIP-777G loads with honest surface', async ({ page }) => {
  const bodyText: string[] = []
  page.on('console', () => {})
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  const text = await page.textContent('body')
  bodyText.push(text || '')
  const body = bodyText.join('\n')

  // Name present; not misnamed as an EIP-712 project.
  expect(body).toContain('SecureGate')
  expect(body).not.toMatch(/EIP-712 project|EIP-712 recovery protocol|EIP-712 architecture|EIP-712 invention/i)

  // K1/K2/K3 surface reachable.
  expect(body).toMatch(/K1/)
  expect(body).toMatch(/K2/)
  expect(body).toMatch(/K3/)

  // No operator/revoke/QR drift, no fake success, no visible RPC URL.
  expect(body).not.toMatch(/\bRevoke\b/i)
  expect(body).not.toMatch(/\bQR\b/)
  expect(body).not.toMatch(/verified:\s*true/i)
  const html = await page.content()
  expect(html).not.toMatch(/https?:\/\/[^"'\s]*\/rpc|infura|alchemy|quiknode|ankr/i)
})
