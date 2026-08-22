#!/usr/bin/env node
/** Live Plein catalog: products, SKUs, counterparties, empty ops. */
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
    const text = document.body?.innerText?.slice(0, 4000) || "";
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
  const email = `miguel.catalog.${Date.now()}@cosecha.test`;
  await page.getByLabel(/^Name$/i).fill("Miguel");
  await page.getByLabel(/^Email$/i).fill(email);
  await page.getByLabel(/^Password$/i).fill("secret123");
  await page.getByRole("button", { name: /Show password/i }).first().click();
  result.showPassword = (await page.locator('input[type="text"][minlength="8"]').count()) >= 1;
  await page.getByLabel(/Confirm password/i).fill("other9999");
  await page.getByRole("button", { name: /Create account/i }).click();
  await page.waitForTimeout(400);
  result.mismatch = await page.getByText(/do not match|no coinciden/i).isVisible();
  await shot(page, "login-confirm");
  await page.getByLabel(/Confirm password/i).fill("secret123");
  await page.getByRole("button", { name: /Create account/i }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(1200);
  const home = await dump(page, "catalog-home");
  result.adminHome = /How Cosecha runs|Products & SKUs/i.test(home.text);
  result.demoGoneHome = !/LOT-2608|OC-2608|PAP-CARTON/i.test(home.text);
  await shot(page, "catalog-home");

  await page.goto(`${BASE}/productos`, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(1000);
  const search = page.getByPlaceholder(/Search product/i);
  if (await search.isVisible().catch(() => false)) {
    await search.fill("Maradol");
    await page.waitForTimeout(300);
  }
  const prod = await dump(page, "catalog-products");
  result.maradol = /Papaya/i.test(prod.text) && /Maradol/i.test(prod.text);
  result.sku = /PAPA-MARA-CAJA-10CT/i.test(prod.text);
  result.skuCountHint = /8 SKU/i.test(prod.text);
  await shot(page, "catalog-productos");

  if (await search.isVisible().catch(() => false)) {
    await search.fill("");
    await page.waitForTimeout(200);
  }
  const allProd = await page.evaluate(() => document.body?.innerText || "");
  result.productCount = (allProd.match(/· \d+ SKU/g) || []).length;
  result.hasJackfruit = /Jackfruit/i.test(allProd);
  result.hasEsparrago = /Espárrago|Esparrago/i.test(allProd);

  await page.goto(`${BASE}/clientes`, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(800);
  const cli = await dump(page, "catalog-customers");
  result.northgate = /Northgate/i.test(cli.text);
  result.papayasMore = /Papayas & More/i.test(cli.text);
  result.noDemoCustomer = !/Mercado Central|Fresh Hub|Retail Valle/i.test(cli.text);
  await shot(page, "catalog-clientes");

  await page.goto(`${BASE}/proveedores`, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(800);
  const pro = await dump(page, "catalog-vendors");
  result.lasBrisas = /Las Brisas/i.test(pro.text);
  result.carrifoods = /Carrifoods/i.test(pro.text);
  result.omega = /Agricola Omega/i.test(pro.text);
  result.noDemoVendor = !/Huerta Los Álamos|Campo Verde|Berries del Pacífico/i.test(pro.text);
  await shot(page, "catalog-proveedores");

  await page.goto(`${BASE}/inventario`, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(800);
  const inv = await dump(page, "catalog-inventory");
  result.noDemoLots = !/LOT-2608/i.test(inv.text);
  await shot(page, "catalog-inventario");

  await page.goto(`${BASE}/compras`, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(800);
  const po = await dump(page, "catalog-compras");
  result.noDemoPO = !/OC-2608/i.test(po.text);
  await shot(page, "catalog-compras");

  await page.goto(`${BASE}/settings?tab=business`, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(800);
  const biz = await dump(page, "catalog-letterhead");
  result.letterhead = /miguelarambulam@gmail.com/i.test(biz.text) || /668-222-2686/.test(biz.text) || /Plein Produce/i.test(biz.text);
  await shot(page, "catalog-settings");
} catch (e) {
  errors.push(String(e));
} finally {
  await browser.close();
}

result.ok =
  result.confirmVisible &&
  result.showPassword &&
  result.mismatch &&
  result.adminHome &&
  result.maradol &&
  result.sku &&
  result.northgate &&
  result.papayasMore &&
  result.lasBrisas &&
  result.noDemoLots &&
  result.noDemoPO &&
  result.noDemoCustomer &&
  errors.length === 0;
console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exit(1);
