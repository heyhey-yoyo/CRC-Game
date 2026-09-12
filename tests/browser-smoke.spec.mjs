import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const standalone = resolve(root, "dist", "standalone-demo.html");

async function openStandalone(page) {
  await page.setContent(readFileSync(standalone, "utf8"), { waitUntil: "load" });
  await page.locator("#landing:not(.is-hidden)").waitFor();
}

async function openUpdateScenario(page) {
  await page.addInitScript(() => {
    const waiting = new EventTarget();
    waiting.state = 'installed';
    const registration = new EventTarget();
    registration.waiting = waiting;
    registration.update = async () => registration;
    const serviceWorker = new EventTarget();
    serviceWorker.controller = { version: 'old' };
    serviceWorker.register = async () => registration;
    const scenario = { serviceWorker, waiting, registration, sent: [], failMessage: false };
    waiting.postMessage = message => {
      if (scenario.failMessage) throw new Error('模拟更新通信失败');
      scenario.sent.push(message);
    };
    Object.defineProperty(navigator, 'serviceWorker', { value: serviceWorker, configurable: true });
    window.updateScenario = scenario;
  });
  await page.route('https://update-check.test/**', route => route.fulfill({
    contentType: 'text/html', body: readFileSync(standalone, 'utf8'),
  }));
  await page.goto('https://update-check.test/');
  await page.locator('#landing:not(.is-hidden)').waitFor();
  await expect(page.locator('#updateButton')).toBeVisible();
}

test('slow Service Worker activation never reloads early and reloads once after takeover', async ({ page }) => {
  let navigations = 0;
  page.on('framenavigated', frame => { if (frame === page.mainFrame()) navigations += 1; });
  await page.clock.install();
  await openUpdateScenario(page);
  await page.locator('#updateButton').click();
  await page.clock.fastForward(10_000);
  expect(navigations).toBe(1);
  await expect(page.locator('#updateButton')).toHaveText('等待新版接管…');
  expect(await page.evaluate(() => window.updateScenario.sent)).toEqual([{ type: 'SKIP_WAITING' }]);
  await page.evaluate(() => {
    const { serviceWorker, waiting } = window.updateScenario;
    serviceWorker.controller = waiting;
    serviceWorker.dispatchEvent(new Event('controllerchange'));
    serviceWorker.dispatchEvent(new Event('controllerchange'));
  });
  await expect.poll(() => navigations).toBe(2);
});

test('failed update preserves the page and permits a new attempt', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await openUpdateScenario(page);
  await page.evaluate(() => { window.updateScenario.failMessage = true; });
  await page.locator('#updateButton').click();
  await expect(page.locator('#updateButton')).toBeEnabled();
  await expect(page.locator('body')).toContainText('当前页面已保留，可稍后重试。');
  await page.evaluate(() => { window.updateScenario.failMessage = false; });
  await page.locator('#updateButton').click();
  await expect(page.locator('#updateButton')).toBeDisabled();
  await page.evaluate(() => {
    const { waiting } = window.updateScenario;
    waiting.state = 'redundant';
    waiting.dispatchEvent(new Event('statechange'));
  });
  await expect(page.locator('#updateButton')).toBeEnabled();
  expect(errors).toEqual([]);
});

test("standalone demo completes the teaching flow without layout or page errors", async ({ browser }) => {
  const errors = [];
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });

  await openStandalone(page);
  const baseFontSize = await page.locator("html").evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
  expect(baseFontSize).toBeGreaterThanOrEqual(16);
  expect(baseFontSize).toBeLessThanOrEqual(20);
  await page.locator("#newCaseButton").click();
  await page.locator("#appShell:not(.is-hidden)").waitFor();

  const positions = await page.locator(".command-grid > .panel").evaluateAll((panels) =>
    panels.slice(0, 6).map((panel) => {
      const box = panel.getBoundingClientRect();
      return { top: Math.round(box.top), left: Math.round(box.left) };
    }),
  );
  expect(positions).toHaveLength(6);
  expect(Math.abs(positions[0].top - positions[1].top)).toBeLessThanOrEqual(4);
  expect(Math.abs(positions[2].top - positions[3].top)).toBeLessThanOrEqual(4);
  expect(Math.abs(positions[4].top - positions[5].top)).toBeLessThanOrEqual(4);
  expect(positions[0].left).toBeLessThan(positions[1].left);

  await page.locator("#advanceButton").click();
  await page.locator("#eventDialog[open]").waitFor();
  await expect(page.locator("#eventDialogTitle")).toContainText("研究性证据返回");
  await page.locator("#eventDialog .button.primary").click();
  await page.locator('[data-hypothesis="selection"]').click();

  for (const expected of ["安全复核", "继续治疗前复核"]) {
    await page.locator("#advanceButton").click();
    await page.locator("#eventDialog[open]").waitFor();
    await expect(page.locator("#eventDialogTitle")).toContainText(expected);
    await page.locator("#eventDialog .button.primary").click();
  }

  await page.locator("#advanceButton").click();
  await page.locator("#recapDialog[open]").waitFor({ timeout: 15_000 });
  await expect(page.locator("#recapGrid .recap-card")).toHaveCount(4);
  await page.locator('#recapDialog button[value="compare"]').click();
  await page.locator("#view-compare.is-active").waitFor();
  await page.locator("#compareBoard:not(.is-hidden)").waitFor();
  await expect(page.locator("#compareBoard .compare-card")).toHaveCount(3);

  const before = await page.locator("body").evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
  await page.locator("#textScaleButton").click();
  const after = await page.locator("body").evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
  expect(after).toBeGreaterThan(before);

  await page.locator("#saveButton").click();
  await expect(page.locator("#saveDialog")).toBeVisible();
  await page.locator("#manualSaveButton").click();
  await expect(page.locator("#saveList .save-record")).toHaveCount(1);
  await page.locator('#saveDialog button[value="close"]').last().click();

  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mobile = await mobileContext.newPage();
  await openStandalone(mobile);
  const overflow = await mobile.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);

  await mobileContext.close();
  await context.close();
  expect(errors).toEqual([]);
});


test('UI save survives a fresh document and the same file imports twice', async ({ page }) => {
  await page.route('https://storage-check.test/**', route => route.fulfill({
    contentType: 'text/html', body: readFileSync(standalone, 'utf8'),
  }));
  await page.goto('https://storage-check.test/');
  await page.locator('#newCaseButton').click();
  await page.locator('#advanceButton').click();
  await page.locator('#eventDialog .button.primary').click();
  await page.locator('#saveButton').click();
  await page.locator('#manualSaveButton').click();
  await expect(page.locator('#saveList [data-load-slot]')).toHaveCount(1);
  const pending = page.waitForEvent('download');
  await page.locator('#exportSaveButton').click();
  const download = await pending;
  expect(await download.failure()).toBeNull();
  const savedText = readFileSync(await download.path(), 'utf8');
  const envelope = JSON.parse(savedText);
  expect(envelope.checksum).toBeTruthy();
  await page.reload();
  await expect(page.locator('#continueCaseButton')).toBeVisible();
  await page.locator('#continueCaseButton').click();
  await page.locator('#saveButton').click();
  const record = await page.evaluate(async () => (await window.CRC_STORAGE.list())[0]);
  expect(record.payload.run).toEqual(envelope.payload.run);
  expect(record.payload.hypotheses).toEqual(envelope.payload.hypotheses);
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.locator('#importSaveInput').setInputFiles({ name: 'roundtrip.json', mimeType: 'application/json', buffer: Buffer.from(savedText) });
    await expect(page.locator('#importSaveInput')).toHaveValue('');
    await expect(page.locator('body')).toContainText('存档已导入');
    const imported = await page.evaluate(async () => (await window.CRC_STORAGE.list())[0]);
    expect(imported.payload.run).toEqual(envelope.payload.run);
  }
});
