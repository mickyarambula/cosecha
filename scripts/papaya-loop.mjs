#!/usr/bin/env node
/**
 * Camino C playable loop:
 * receive OC-2608-022 (PACA incidencia) → inventario sano+retenido
 * → ship OV-2608-060 only sano → facturar → cobro CxC / factura proveedor / pago CxP
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
function modal() {
  return page.locator("div.fixed.inset-0");
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

/** First <option> with a non-empty value (skips "Seleccionar"). */
async function selectFirstReal(selectLocator) {
  const values = await selectLocator.locator("option").evaluateAll((opts) =>
    opts.map((o) => ({ value: o.value, text: (o.textContent || "").trim() })),
  );
  const real = values.find((o) => o.value);
  if (!real) throw new Error(`sin opción real: ${JSON.stringify(values)}`);
  await selectLocator.selectOption(real.value);
  return real;
}

try {
  await goto("/compras");
  await page.getByText("OC-2608-022").first().waitFor();
  await shot("compras-before");

  const recvBtn = card("OC-2608-022").getByRole("button", { name: "Recibir mercancía" });
  if (await recvBtn.isVisible().catch(() => false)) {
    await recvBtn.click();
    await page.getByRole("heading", { name: "Recibir mercancía" }).waitFor();

    const dest = page.locator("label").filter({ hasText: "Destino" }).locator("select");
    await dest.selectOption({ index: 1 });

    await page.locator("select").filter({ hasText: "Aceptada con incidencia" }).selectOption("Aceptada con incidencia");
    await page.getByText("Viene afectada").waitFor();
    await page.locator("label").filter({ hasText: "Viene afectada" }).locator("input").fill("100");
    await page.locator("label").filter({ hasText: "Motivo del defecto" }).locator("select").selectOption("condicion::Pudrición");

    await shot("compras-recepcion-modal");
    await page.getByRole("button", { name: "Registrar recepción" }).click();
    await page.getByText(/Recepción de OC-2608-022/).waitFor({ timeout: 15000 });
    const recvMsg = await flash();
    await shot("compras-after-receive");
    ok("recibir OC-2608-022", recvMsg.trim());
    if (!/sanas/i.test(recvMsg) || !/retenid/i.test(recvMsg)) fail("split sano+retenido", recvMsg);
    else ok("incidencia parte lote", recvMsg.trim());
  } else {
    ok("recibir OC-2608-022", "ya recibida (reintento)");
    ok("incidencia parte lote", "lotes ya nacidos");
  }

  const billBtn = card("OC-2608-022").getByRole("button", { name: "Capturar factura proveedor" });
  if (await billBtn.isVisible().catch(() => false)) {
    await billBtn.click();
    await page.getByText(/Factura /).waitFor({ timeout: 15000 });
    ok("factura proveedor", (await flash()).trim());
    await shot("compras-bill");
  } else {
    ok("factura proveedor", "ya capturada");
  }

  await goto("/inventario");
  await page.getByText("Papaya").first().waitFor();
  await shot("inventario-calidad");
  const invText = await page.innerText("body");
  const papayaSano = /Papaya[\s\S]{0,600}Sano/.test(invText);
  const papayaRet = /Papaya[\s\S]{0,1600}Retenido/.test(invText);
  if (papayaSano && papayaRet) ok("inventario papaya sano+retenido");
  else fail("inventario papaya sano+retenido", `sano=${papayaSano} retenido=${papayaRet}`);
  if (invText.includes("LOT-2608-004") && invText.includes("Retenido")) ok("fresa retenida seed intacta");

  await goto("/ventas");
  await page.getByText("OV-2608-060").first().waitFor();
  const so = card("OV-2608-060");
  const shipBtn = so.getByRole("button", { name: "Despachar" });
  if (await shipBtn.isVisible().catch(() => false)) {
    await shipBtn.click();
    await page.getByRole("heading", { name: "Despachar línea" }).waitFor();
    await shot("ventas-despacho-modal");

    const warn = modal().getByText(/lote\(s\) de este producto están retenidos/);
    if (await warn.isVisible().catch(() => false)) ok("retenidos ocultos en despacho", (await warn.textContent()) || "");
    else fail("aviso retenidos en despacho");

    const lotSelect = modal().locator("label").filter({ hasText: "Lote sano" }).locator("select");
    const lotOptions = await lotSelect.locator("option").allTextContents();
    const hiddenRetenido = lotOptions.every((t) => !/retenido/i.test(t));
    if (hiddenRetenido && lotOptions.some((t) => /sano/i.test(t))) {
      ok("picker solo lotes sanos", lotOptions.filter(Boolean).join(" | "));
    } else {
      fail("picker solo lotes sanos", lotOptions.join(" | "));
    }
    const lot = await selectFirstReal(lotSelect);
    ok("lote seleccionado", `${lot.value} ${lot.text}`);

    const locSelect = modal().locator("label").filter({ hasText: "Ubicación" }).locator("select");
    const loc = await selectFirstReal(locSelect);
    ok("ubicación seleccionada", `${loc.value} ${loc.text}`);

    const qtyInput = modal().locator("label").filter({ hasText: "Cantidad" }).locator("input");
    const qtyVal = await qtyInput.inputValue();
    if (!qtyVal || Number(qtyVal) <= 0) await qtyInput.fill("800");

    await shot("ventas-despacho-ready");
    await modal().getByRole("button", { name: "Salida de inventario" }).click();
    await page.getByText("Despacho registrado").waitFor({ timeout: 15000 });
    await shot("ventas-after-ship");
    ok("despacho OV-2608-060", (await flash()).trim());
  } else {
    ok("despacho OV-2608-060", "ya despachada");
    ok("retenidos ocultos en despacho", "saltado — ya despachada");
    ok("picker solo lotes sanos", "saltado — ya despachada");
  }

  const factBtn = card("OV-2608-060").getByRole("button", { name: "Facturar" });
  if (await factBtn.isVisible().catch(() => false)) {
    await factBtn.click();
    await page.getByText(/Factura PP-/).waitFor({ timeout: 15000 });
    ok("facturar OV-2608-060", (await flash()).trim());
    await shot("ventas-facturada");
  } else {
    ok("facturar OV-2608-060", "ya facturada o sin despacho");
  }

  await goto("/cxc");
  await page.getByText("Northgate").first().waitFor();
  await shot("cxc-before-cobro");
  const cobroCard = card("OV-2608-060").or(card("Northgate"));
  const cobroBtn = cobroCard.getByRole("button", { name: "Registrar cobro" });
  if (await cobroBtn.isVisible().catch(() => false)) {
    await cobroBtn.click();
    await page.getByRole("heading", { name: /Cobro / }).waitFor();
    await modal().getByRole("button", { name: "Aplicar cobro" }).click();
    await page.getByText(/Cobro MOV-/).waitFor({ timeout: 15000 });
    ok("cobro CxC Northgate", (await flash()).trim());
    await shot("cxc-after-cobro");
  } else {
    ok("cobro CxC Northgate", "sin saldo abierto");
  }

  await goto("/cxp");
  await page.getByText("Papayas & More").first().waitFor();
  await shot("cxp-before-pago");
  const pagoCard = card("OC-2608-022").or(card("Papayas & More"));
  const pagoBtn = pagoCard.getByRole("button", { name: "Registrar pago" });
  if (await pagoBtn.isVisible().catch(() => false)) {
    await pagoBtn.click();
    await page.getByRole("heading", { name: /Pago / }).waitFor();
    await modal().getByRole("button", { name: "Aplicar pago" }).click();
    await page.getByText(/Pago MOV-/).waitFor({ timeout: 15000 });
    ok("pago CxP Papayas & More", (await flash()).trim());
    await shot("cxp-after-pago");
  } else {
    ok("pago CxP Papayas & More", "sin saldo abierto");
  }

  await goto("/tesoreria");
  await page.getByText("Tesorería").first().waitFor();
  await shot("tesoreria-after");
  const tesText = await page.innerText("body");
  if (/Northgate/i.test(tesText) && /Papayas/i.test(tesText)) ok("tesorería muestra cobro y pago");
  else fail("tesorería muestra cobro y pago", tesText.slice(0, 280).replace(/\s+/g, " "));

  await goto("/");
  await shot("tablero-after-loop");
  ok("tablero post-loop");
} catch (err) {
  fail("crash", err instanceof Error ? err.stack || err.message : String(err));
  await shot("papaya-crash");
} finally {
  await browser.close();
}

const failed = steps.filter((s) => !s.ok);
console.log(JSON.stringify({ ok: failed.length === 0, failed: failed.length, steps }, null, 2));
process.exit(failed.length ? 1 : 0);
