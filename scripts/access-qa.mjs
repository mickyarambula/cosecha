import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const BASE = "http://127.0.0.1:8080";
mkdirSync("/workspace/screenshots", { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [];
const result = { errors };

async function shot(page, name) {
  await page.screenshot({ path: `/workspace/screenshots/${name}.png`, fullPage: true });
}

function dump(page, label) {
  return page.evaluate((l) => {
    const text = document.body?.innerText?.slice(0, 1800) || "";
    console.log(`\n=== ${l} url=${location.href} ===\n${text}\n`);
    return { url: location.href, text };
  }, label);
}

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 45000 });
  await page.getByRole("button", { name: /Need an account/i }).click();
  result.confirmVisible = await page.getByText(/Confirm password/i).isVisible();
  const email = `miguel.${Date.now()}@cosecha.test`;
  await page.getByLabel(/^Name$/i).fill("Miguel");
  await page.getByLabel(/^Email$/i).fill(email);
  await page.getByLabel(/^Password$/i).fill("secret123");
  await page.getByRole("button", { name: /Show password/i }).first().click();
  const shown = await page.locator('input[type="text"][minlength="8"]').count();
  result.showPassword = shown >= 1;
  await page.getByLabel(/Confirm password/i).fill("other9999");
  await page.getByRole("button", { name: /Create account/i }).click();
  await page.waitForTimeout(400);
  result.mismatch = await page.getByText(/do not match|no coinciden/i).isVisible();
  await shot(page, "login-confirm");

  await page.getByLabel(/Confirm password/i).fill("secret123");
  await page.getByRole("button", { name: /Create account/i }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1200);
  const home = await dump(page, "qa-home");
  result.signedIn = /How Cosecha runs|Waiting for access|Esperando/i.test(home.text);
  result.isAdminHome = /How Cosecha runs/i.test(home.text);
  result.waiting = /Waiting for access|Esperando acceso/i.test(home.text);
  await shot(page, "after-signup-access");

  if (result.isAdminHome) {
    await page.goto(`${BASE}/settings?tab=teams`, { waitUntil: "networkidle" });
    await page.waitForTimeout(800);
    const teams = await dump(page, "qa-teams");
    result.teams = /Grant|Otorgar|Waiting|En espera/i.test(teams.text);
    result.miguel = /Miguel/i.test(teams.text);
    await shot(page, "settings-teams");
  }

  const pub = await browser.newPage({ viewport: { width: 900, height: 700 } });
  await pub.goto(`${BASE}/doc/oc/1`, { waitUntil: "networkidle" });
  await pub.waitForTimeout(600);
  const doc = await dump(pub, "qa-doc");
  result.publicDoc = !/Sign in|Create account|Need an account/i.test(doc.text);
  result.docNotLogin = !/\/login/.test(doc.url);
  await shot(pub, "doc-public-access");
} catch (e) {
  errors.push(String(e));
} finally {
  await browser.close();
}

result.ok = result.confirmVisible && result.showPassword && result.mismatch && result.signedIn && result.publicDoc && errors.length === 0;
console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exit(1);
