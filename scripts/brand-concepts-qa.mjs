/** Logo, concepts, Chase register, opening numbers still hold. */
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

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 45000 });
  const login = await page.evaluate(() => document.body?.innerText || "");
  result.loginWordmark = await page.locator('img[alt="Plein Produce"]').count();
  result.loginLeafGone = !/class="lucide-leaf"/i.test(await page.content());
  await shot(page, "brand-login");

  await page.getByRole("button", { name: /Need an account/i }).click();
  const email = `miguel.brand.${Date.now()}@cosecha.test`;
  await page.getByLabel(/^Name$/i).fill("Miguel");
  await page.getByLabel(/^Email$/i).fill(email);
  await page.getByLabel(/^Password$/i).fill("secret123");
  await page.getByLabel(/Confirm password/i).fill("secret123");
  await page.getByRole("button", { name: /Create account/i }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(2000);

  const home = await page.evaluate(() => document.body?.innerText || "");
  result.homeReceivable = /673,014/.test(home);
  result.homePayable = /570,097/.test(home);
  result.homeCash = /9,361/.test(home);
  result.railMark = await page.locator('aside img[alt="Plein Produce"]').count();
  await shot(page, "brand-home");

  await page.goto(`${BASE}/tesoreria`, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(800);
  const cash = await page.evaluate(() => document.body?.innerText || "");
  result.tesoreriaRegister = /Register Chase line/i.test(cash);
  result.corteChase = /CORTE-CHASE/.test(cash);
  await shot(page, "brand-tesoreria");
  await page.getByRole("button", { name: /Register Chase line/i }).click();
  await page.waitForTimeout(400);
  const modal = await page.evaluate(() => document.body?.innerText || "");
  result.chaseFolioField = /Chase folio/i.test(modal);
  result.conceptField = /Concept/i.test(modal);
  await shot(page, "brand-chase-modal");
  await page.keyboard.press("Escape");

  await page.goto(`${BASE}/settings?tab=concepts`, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(1000);
  const concepts = await page.evaluate(() => document.body?.innerText || "");
  result.conceptMateria = /Materia prima/.test(concepts);
  result.conceptCert = /Certificados/.test(concepts);
  result.conceptV8 = /Cobros bancarios/.test(concepts);
  await shot(page, "brand-concepts");

  await page.goto(`${BASE}/gastos?tab=list`, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: /Add new expense/i }).click();
  await page.waitForTimeout(500);
  const exp = await page.evaluate(() => document.body?.innerText || "");
  result.gastoType = /Materia prima|Costo|Fletes/.test(exp);
  await shot(page, "brand-gasto");
} catch (e) {
  errors.push(String(e));
} finally {
  await browser.close();
}

console.log("RESULT", JSON.stringify(result, null, 2));
const required = [
  "homeReceivable",
  "homePayable",
  "homeCash",
  "tesoreriaRegister",
  "corteChase",
  "chaseFolioField",
  "conceptMateria",
  "conceptCert",
];
const failed = required.filter((k) => !result[k]);
if (errors.length || failed.length) {
  console.error("FAILED", failed, errors);
  process.exit(1);
}
console.log("brand-concepts-qa ok");
