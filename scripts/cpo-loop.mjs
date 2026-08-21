#!/usr/bin/env node
/**
 * Camino C door: convert CPO-2608-001 (NGM247514) → OV → Generar compra.
 */
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

function card(text) {
  return page.locator("div.rounded-xl.border").filter({ hasText: text }).first();
}
async function flash() {
  const el = page.locator("p.mb-3.text-sm.text-ok").first();
  if (await el.isVisible().catch(() => false)) return (await el.textContent()) || "";
  return "";
}
async function shot(name) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
}
async function goto(path) {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
}

try {
  await goto("/");
  await page.getByRole("heading", { name: "Tablero" }).waitFor();
  await shot("cpo-tablero");
  const home = await page.innerText("body");
  if (/CPO-2608-001|por convertir/.test(home)) ok("tablero alerta CPO");
  else ok("tablero carga", "sin alerta CPO visible (puede ya convertido)");

  await goto("/cpo");
  await page.getByRole("heading", { name: "Customer PO" }).waitFor();
  await page.getByText("CPO-2608-001").first().waitFor();
  await page.getByText("NGM247514").first().waitFor();
  await page.getByText("Northgate").first().waitFor();
  await shot("cpo-list");
  ok("lista CPO-2608-001 NGM247514");

  const row = page.locator("tr").filter({ hasText: "CPO-2608-001" });
  const already = await row.getByText("Convertido").isVisible().catch(() => false);
  let soNumber = "";
  if (!already) {
    await page.getByRole("button", { name: "CPO-2608-001" }).click();
    await page.getByRole("heading", { name: /Customer PO CPO-2608-001/ }).waitFor();
    await shot("cpo-detalle");
    await page.getByRole("button", { name: "Convertir a venta" }).click();
    const flashEl = page.locator("p.mb-3.text-sm.text-ok").first();
    await flashEl.waitFor({ timeout: 15000 });
    const msg = ((await flashEl.textContent()) || "").trim();
    const m = msg.match(/venta\s+(OV-\S+)/i);
    soNumber = m?.[1] || "";
    await shot("cpo-convertido");
    if (!soNumber) fail("convertir CPO a OV", msg);
    else ok("convertir CPO a OV", msg);
  } else {
    await page.getByRole("button", { name: "CPO-2608-001" }).click();
    await page.getByRole("heading", { name: /Customer PO CPO-2608-001/ }).waitFor();
    const link = page.getByRole("link", { name: /Ver venta/ });
    const t = (await link.textContent().catch(() => "")) || "";
    soNumber = (t.match(/OV-\S+/) || [])[0] || "";
    await page.getByRole("button", { name: "Cerrar" }).click();
    ok("convertir CPO a OV", `ya convertido ${soNumber}`);
  }

  await goto("/ventas");
  await page.getByText("Northgate").first().waitFor();
  const body = await page.innerText("body");
  if (!/CPO-2608-001/.test(body)) fail("OV ligada a CPO", "no aparece CPO-2608-001");
  else ok("OV ligada a CPO");
  if (!/1,056/.test(body) && !/1056/.test(body)) fail("RAPO 1056", body.slice(0, 500));
  else ok("RAPO papaya 1056");
  await shot("ventas-rapo");

  const soCard = soNumber ? card(soNumber) : card("CPO-2608-001");
  const buyBtn = soCard.getByRole("button", { name: "Generar compra" });
  if (await buyBtn.isVisible().catch(() => false)) {
    await buyBtn.click();
    await page.getByRole("heading", { name: "Generar compra" }).waitFor();
    const supplier = page.locator("label").filter({ hasText: "Proveedor" }).locator("select");
    const opts = await supplier.locator("option").evaluateAll((os) =>
      os.map((o) => ({ value: o.value, text: (o.textContent || "").trim() })),
    );
    const papaya = opts.find((o) => /Papayas/i.test(o.text));
    if (!papaya) throw new Error(`sin Papayas & More: ${JSON.stringify(opts)}`);
    await supplier.selectOption(papaya.value);
    await page.locator("label").filter({ hasText: "Costo unitario" }).locator("input").fill("21");
    await shot("ventas-generar-compra");
    await page.getByRole("button", { name: "Generar compra" }).last().click();
    await page.getByText(/Compra .* generada/).waitFor({ timeout: 15000 });
    ok("generar compra desde OV", (await flash()).trim());
    await shot("ventas-compra-ok");
  } else {
    ok("generar compra desde OV", "ya generada");
  }

  await goto("/compras");
  const compras = await page.innerText("body");
  if (!/Desde OV/.test(compras) && !/OV-/.test(compras)) fail("compra ligada a OV", compras.slice(0, 300));
  else ok("compra muestra SO");
  await shot("compras-desde-ov");

  await goto("/cpo");
  const afterRow = page.locator("tr").filter({ hasText: "CPO-2608-001" });
  if (await afterRow.getByText("Convertido").isVisible().catch(() => false)) ok("CPO marcado convertido");
  else fail("CPO marcado convertido");
  await shot("cpo-after");
} catch (err) {
  fail("loop", err instanceof Error ? err.message : String(err));
  await shot("cpo-error").catch(() => {});
} finally {
  await browser.close();
  const passed = steps.filter((s) => s.ok).length;
  const failed = steps.filter((s) => !s.ok).length;
  console.log(`\n${passed} ok / ${failed} fail`);
  process.exit(failed ? 1 : 0);
}
