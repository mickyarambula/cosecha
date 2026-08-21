#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const BASE = "http://127.0.0.1:8080";
const OUT = "/workspace/screenshots";
mkdirSync(OUT, { recursive: true });

const steps = [];
function ok(name, extra = "") {
  steps.push({ name, ok: true, extra });
  console.log(`✓ ${name}${extra ? " — " + extra : ""}`);
}
function fail(name, extra = "") {
  steps.push({ name, ok: false, extra });
  console.error(`✗ ${name}${extra ? " — " + extra : ""}`);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.setDefaultTimeout(20000);

async function shot(name) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
}
async function goto(path) {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
}

try {
  await goto("/productos");
  await page.getByText("PAP-CARTON-10CT").first().waitFor();
  const body = await page.innerText("body");
  if (/PAP-CARTON-10CT/.test(body) && /PAP-CARTON-7CT/.test(body) && /Clamshell/.test(body) && /Plastic Crate/.test(body)) {
    ok("matriz papaya 24 SKUs", "Carton/Clam/Crate × calibres");
  } else fail("matriz papaya 24 SKUs", body.slice(0, 400));
  await shot("productos-matriz");

  await goto("/proveedores");
  await page.getByText("Papayas & More").first().waitFor();
  const prov = await page.locator("tr").filter({ hasText: "Papayas & More" }).innerText();
  if (/Proveedor/.test(prov) && /Cliente/.test(prov)) ok("Papayas & More dual", prov.replace(/\s+/g, " ").trim());
  else fail("Papayas & More dual", prov);
  await shot("proveedores-dual");

  await goto("/clientes");
  await page.getByText("Papayas & More").first().waitFor();
  const cli = await page.locator("tr").filter({ hasText: "Papayas & More" }).innerText();
  if (/Proveedor/.test(cli) && /Cliente/.test(cli)) ok("cliente dual Papayas & More");
  else fail("cliente dual Papayas & More", cli);
  await shot("clientes-dual");

  await goto("/cpo");
  await page.getByRole("button", { name: "Nuevo Customer PO" }).click();
  await page.getByRole("heading", { name: "Nuevo Customer PO" }).waitFor();
  const skuOpts = await page.locator("select").nth(0).locator("option").allTextContents();
  // SKU is the second or later select; find one with PAP-CARTON-10CT
  const allOpts = await page.locator("option").allTextContents();
  if (allOpts.some((t) => t.includes("PAP-CARTON-10CT"))) ok("picker CPO muestra SKU 10 ct");
  else fail("picker CPO muestra SKU 10 ct", allOpts.join(" | ").slice(0, 300));
  await shot("cpo-sku-picker");
} catch (e) {
  fail("crash", e instanceof Error ? e.message : String(e));
  await shot("catalog-crash");
} finally {
  await browser.close();
  const bad = steps.filter((s) => !s.ok).length;
  console.log(`\n${steps.filter((s) => s.ok).length} ok / ${bad} fail`);
  process.exit(bad ? 1 : 0);
}
