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
