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
await page.waitForTimeout(800);
await page.screenshot({ path: "/workspace/screenshots/prefs-light-en.png", fullPage: false });

await page.getByRole("button", { name: "Theme" }).click();
await page.waitForTimeout(400);
const dark = await page.evaluate(() => document.documentElement.classList.contains("dark"));
await page.screenshot({ path: "/workspace/screenshots/prefs-dark-en.png", fullPage: false });

await page.getByRole("button", { name: "Language" }).click();
await page.waitForTimeout(400);
const lang = await page.evaluate(() => document.documentElement.lang);
const favorites = await page.locator("h1").first().innerText();
await page.screenshot({ path: "/workspace/screenshots/prefs-dark-es.png", fullPage: false });

await page.goto(`${BASE}/settings?tab=appearance`, { waitUntil: "networkidle" });
await page.waitForTimeout(500);
const appearanceH = await page.locator("h2").first().innerText();
await page.screenshot({ path: "/workspace/screenshots/prefs-appearance.png", fullPage: false });

await page.goto(`${BASE}/compras`, { waitUntil: "networkidle" });
await page.waitForTimeout(600);
const allOrders = await page.getByRole("button").filter({ hasText: /Todas|All Orders/ }).first().innerText();
await page.screenshot({ path: "/workspace/screenshots/prefs-compras-es.png", fullPage: false });

await browser.close();
const result = {
  ok: dark && lang === "es" && /Favoritos|Favorites/.test(favorites) && errors.length === 0,
  dark,
  lang,
  favorites,
  appearanceH,
  allOrders,
  errors,
};
console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exit(1);
