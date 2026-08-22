import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const BASE = "http://127.0.0.1:8080";
mkdirSync("/workspace/screenshots", { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.addInitScript(() => {
  localStorage.setItem("cosecha-prefs", JSON.stringify({ state: { theme: "light", locale: "es" }, version: 0 }));
});
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 45000 });
if (page.url().includes("/login")) {
  const email = page.locator('input[type="email"]');
  if (await email.isVisible().catch(() => false)) {
    await email.fill("miguelarambulam@gmail.com");
    await page.locator('input[type="password"]').first().fill("Cosecha!miguel1");
    await page.getByRole("button", { name: /^Entrar$|^Sign in$/i }).click();
    await page.waitForTimeout(1500);
  }
}
const authed = !page.url().includes("/login");
await page.goto(`${BASE}/settings?tab=tests`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await page.screenshot({ path: "/workspace/screenshots/settings-tests.png", fullPage: true });
const body = (await page.locator("body").innerText()).slice(0, 1200);
const hasWipe = /Borrar pruebas|Wipe tests/i.test(body);
await browser.close();
console.log(JSON.stringify({ authed, hasWipe, url: page.url?.() || "", body: body.slice(0, 500), errors }, null, 2));
