// Localhost-only test driver. Browser profiles (including tokens) stay in TEMP.
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { chromium } = require(path.join(os.tmpdir(), 'maternal-baseline-tools/node_modules/playwright'));
const role = process.argv[2];
const scenario = path.resolve(process.argv[3]);
const emails = { patient: 'patient.thanhhang@gmail.com', other: 'patient.ngocmai@gmail.com', receptionist: 'reception.hoangyen@antam.local', doctor: 'dr.lethuha@antam.local' };
const output = path.resolve(process.env.QA_OUTPUT_DIR || 'docs/testing/baseline-2026-11-14');
(async () => {
  await fs.mkdir(output, { recursive: true });
  const context = await chromium.launchPersistentContext(path.join(os.tmpdir(), 'maternal-baseline-profile-' + role), {
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
    viewport: { width: 1440, height: 1000 }, timezoneId: 'Asia/Ho_Chi_Minh',
  });
  const page = context.pages()[0] || await context.newPage();
  const events = [], errors = [], assertions = [];
  page.setDefaultTimeout(10000);
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', async response => {
    if (!response.url().startsWith('http://localhost:8080/') || response.url().includes('/auth/')) return;
    const event = { method: response.request().method(), url: response.url(), status: response.status() };
    if (response.request().method() !== 'GET' || response.status() >= 400) {
      try { event.body = await response.json(); } catch {}
    }
    events.push(event);
  });
  let failure;
  try {
    await page.goto('http://localhost:3000/');
    await page.waitForTimeout(500);
    if (await page.getByRole('link', { name: 'Đăng nhập', exact: true }).count()) {
      await page.goto('http://localhost:3000/dang-nhap');
      await page.locator('#login-email').fill(emails[role]);
      await page.getByLabel('Mật khẩu', { exact: true }).fill(process.env.QA_DEMO_PASSWORD || 'Demo@123456');
      await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
      await page.waitForURL(url => !url.pathname.includes('dang-nhap'));
    }
    await require(scenario)({ page, context, output, events, assertions, fs,
      check: (id, ok, detail) => { assertions.push({ id, status: ok ? 'PASS' : 'FAIL', detail }); },
    });
  } catch (e) { failure = e.message; console.error(failure); }
  const name = path.basename(scenario, '.cjs');
  await page.screenshot({ path: path.join(output, name + '.png'), fullPage: true }).catch(() => {});
  const text = await page.locator('body').innerText().catch(() => '');
  await fs.writeFile(path.join(output, name + '.json'), JSON.stringify({ role, url: page.url(), assertions, errors, failure, events, text }, null, 2));
  console.log(JSON.stringify({ role, url: page.url(), assertions, errors, failure, text: text.slice(0, 14000) }, null, 2));
  await context.close();
  if (failure || assertions.some(x => x.status === 'FAIL')) process.exitCode = 1;
})().catch(e => { console.error(e.message); process.exitCode = 1; });
