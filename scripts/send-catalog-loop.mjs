import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const BASE = "http://127.0.0.1:8080";
mkdirSync("/workspace/screenshots", { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});

await page.goto(BASE, { waitUntil: "networkidle", timeout: 45000 });
await page.waitForTimeout(600);
const homeHasProducts = await page.getByText("Products & SKUs").first().isVisible().catch(() => false);
await page.screenshot({ path: "/workspace/screenshots/catalog-home.png" });

await page.goto(`${BASE}/productos?tab=catalog`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
const newProduct = await page.getByRole("button", { name: /New product/i }).first().isVisible().catch(() => false);
const papaya = await page.getByText(/Papaya/i).first().isVisible().catch(() => false);
await page.screenshot({ path: "/workspace/screenshots/catalog-page.png" });

await page.goto(`${BASE}/inventario?tab=units`, { waitUntil: "networkidle" });
await page.waitForTimeout(600);
const banner = await page.getByText(/stock on lots|existencia de lotes/i).first().isVisible().catch(() => false);
await page.screenshot({ path: "/workspace/screenshots/inventory-banner.png" });

await page.goto(`${BASE}/compras`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
const sendBtn = page.getByRole("button", { name: /Send \/ WhatsApp/i }).first();
const sendVisible = await sendBtn.isVisible().catch(() => false);
if (sendVisible) {
  await sendBtn.click();
  await page.waitForTimeout(400);
}
const wa = await page.getByRole("button", { name: /^WhatsApp$/i }).first().isVisible().catch(() => false);
await page.screenshot({ path: "/workspace/screenshots/send-modal.png" });

await browser.close();
const result = { ok: homeHasProducts && newProduct && papaya && banner && wa && errors.length === 0, homeHasProducts, newProduct, papaya, banner, sendVisible, wa, errors };
console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exit(1);
