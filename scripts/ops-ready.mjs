import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const BASE = "http://127.0.0.1:8080";
mkdirSync("/workspace/screenshots", { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [];
function attach(page) {
  page.on("pageerror", (e) => errors.push("page:" + String(e)));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push("console:" + msg.text());
  });
}

async function shot(page, name) {
  await page.screenshot({ path: `/workspace/screenshots/${name}.png`, fullPage: true });
}

async function dump(page, name) {
  await shot(page, name);
  const text = ((await page.locator("body").innerText().catch(() => "")) || "").slice(0, 1500);
  console.log(`\n=== ${name} url=${page.url()} ===\n${text}\n`);
}

const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
attach(page);
const result = {};

await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 45000 });
await page.waitForTimeout(500);
result.loginVisible = await page.getByRole("heading", { name: /Sign in/i }).isVisible().catch(() => false);
await dump(page, "qa-login");

await page.getByText(/Need an account/i).click();
await page.waitForTimeout(200);
const email = `ops.${Date.now()}@cosecha.test`;
await page.locator('input[autocomplete="name"]').fill("Ops Ready");
await page.locator('input[type="email"]').fill(email);
await page.locator('input[type="password"]').fill("Cosecha!ready1");
await page.getByRole("button", { name: /Create account/i }).click();
await page.waitForURL((url) => !String(url).includes("/login"), { timeout: 25000 }).catch(() => {});
await page.waitForTimeout(1000);
result.signedUp = !page.url().includes("/login");
result.home = await page.getByText(/How Cosecha runs/i).isVisible().catch(() => false);
await dump(page, "qa-home");

await page.goto(`${BASE}/productos?tab=repack`, { waitUntil: "networkidle" });
await page.waitForTimeout(600);
result.packOut = await page.getByRole("button", { name: /New pack-out/i }).isVisible().catch(() => false);
if (result.packOut) {
  await page.getByRole("button", { name: /New pack-out/i }).click();
  await page.waitForTimeout(400);
  await dump(page, "qa-packout-modal");
  await page.keyboard.press("Escape");
}

await page.goto(`${BASE}/tesoreria?tab=reconcile`, { waitUntil: "networkidle" });
await page.waitForTimeout(600);
result.reconcile = await page.getByRole("button", { name: /Add statement line/i }).isVisible().catch(() => false);
if (result.reconcile) {
  await page.getByRole("button", { name: /Add statement line/i }).click();
  await page.getByLabel(/^Description$/i).fill("Wells Fargo deposit");
  await page.getByLabel(/^Amount$/i).fill("10.00");
  await page.getByRole("button", { name: /^Add$/i }).click();
  await page.waitForTimeout(700);
}
await dump(page, "qa-reconcile");

await page.goto(`${BASE}/settings?tab=business`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
result.legalVisible = await page.getByText(/Legal name/i).isVisible().catch(() => false);
await dump(page, "qa-business");
if (result.legalVisible) {
  await page.getByLabel(/Legal name/i).fill("Plein Produce LLC");
  await page.getByRole("button", { name: /Save/i }).click();
  await page.waitForTimeout(800);
  result.businessSaved = await page.getByText(/^Saved$/i).isVisible().catch(() => false);
} else {
  result.businessSaved = false;
}

await page.goto(`${BASE}/reportes?tab=settlements`, { waitUntil: "networkidle" });
await page.waitForTimeout(1000);
result.settlements = /Vendor settlements|OC-|PO-/.test(await page.locator("body").innerText());
await dump(page, "qa-settlements");

await page.goto(`${BASE}/settings?tab=sent`, { waitUntil: "networkidle" });
await page.waitForTimeout(600);
result.sendLog = /Nothing sent yet|email|WhatsApp/i.test(await page.locator("body").innerText());
await dump(page, "qa-sent");

const guest = await browser.newPage({ viewport: { width: 1100, height: 900 } });
attach(guest);
await guest.goto(`${BASE}/doc/oc/1`, { waitUntil: "networkidle", timeout: 30000 });
await guest.waitForTimeout(500);
result.publicDoc = /Plein Produce|Purchase Order/.test(await guest.locator("body").innerText());
await dump(guest, "qa-public-doc");

await guest.goto(`${BASE}/portal/1`, { waitUntil: "networkidle", timeout: 30000 });
await guest.waitForTimeout(700);
result.publicPortal = /Plein|vendor|portal|purchase|lot/i.test(await guest.locator("body").innerText());
await dump(guest, "qa-public-portal");

await browser.close();
result.errors = errors.filter((e) => !/aborted|ResizeObserver|favicon/i.test(e)).slice(0, 20);
result.ok =
  result.loginVisible &&
  result.signedUp &&
  result.home &&
  result.packOut &&
  result.reconcile &&
  result.legalVisible &&
  result.businessSaved &&
  result.settlements &&
  result.publicDoc &&
  result.publicPortal;
writeFileSync("/tmp/ops-ready.json", JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exit(1);
