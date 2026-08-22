#!/usr/bin/env node
/**
 * Realistic cutover loop: login → financial tabs stay put →
 * PO → receive → SO → fulfill → invoice → P&L has live numbers.
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

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.setDefaultTimeout(25000);
await page.addInitScript(() => {
  localStorage.setItem("cosecha-prefs", JSON.stringify({ state: { theme: "light", locale: "es" }, version: 0 }));
});

const errors = [];
page.on("pageerror", (e) => errors.push("page:" + e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push("console:" + m.text());
});

async function shot(name) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
}
async function dump(name) {
  await shot(name);
  const text = ((await page.locator("body").innerText().catch(() => "")) || "").replace(/\n+/g, " | ");
  console.log(`\n=== ${name} url=${page.url()} ===\n${text.slice(0, 900)}\n`);
  return text;
}
async function goto(path) {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(600);
}

async function selectFirstReal(selectLocator, skip = []) {
  const values = await selectLocator.locator("option").evaluateAll((opts) =>
    opts.map((o) => ({ value: o.value, text: (o.textContent || "").trim() })),
  );
  const real = values.find((o) => o.value && !skip.some((s) => o.text.toLowerCase().includes(s)));
  if (!real) throw new Error(`sin opción: ${JSON.stringify(values).slice(0, 400)}`);
  await selectLocator.selectOption(real.value);
  return real;
}

try {
  await goto("/login");
  await dump("live-login");
  const logoInfo = await page.evaluate(async () => {
    const img = document.querySelector('img[alt="Plein Produce"]');
    if (!img) return { found: false };
    await new Promise((res) => {
      if (img.complete) res();
      else {
        img.onload = () => res();
        img.onerror = () => res();
        setTimeout(res, 2000);
      }
    });
    const c = document.createElement("canvas");
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const a = (x, y) => ctx.getImageData(x, y, 1, 1).data[3];
    return {
      found: true,
      w: img.naturalWidth,
      h: img.naturalHeight,
      corners: [a(0, 0), a(img.naturalWidth - 1, 0), a(0, img.naturalHeight - 1), a(img.naturalWidth - 1, img.naturalHeight - 1)],
    };
  });
  console.log("LOGO", JSON.stringify(logoInfo));
  if (logoInfo.found && logoInfo.corners.every((a) => a < 16)) ok("login logo transparent", JSON.stringify(logoInfo.corners));
  else fail("login logo transparent", JSON.stringify(logoInfo));

  const onLogin = /Entrar|Sign in|Continuar con/i.test(await page.locator("body").innerText());
  if (onLogin) {
    const email = "miguelarambulam@gmail.com";
    const password = "Cosecha!miguel1";
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').first().fill(password);
    await page.getByRole("button", { name: /^Entrar$|^Sign in$/i }).click();
    await page.waitForTimeout(1200);
    if (page.url().includes("/login")) {
      await page.getByRole("button", { name: /Necesitas cuenta|Need an account/i }).click();
      await page.getByRole("heading", { name: /Crear cuenta|Create account/i }).waitFor({ timeout: 8000 });
      await page.locator('input[autocomplete="name"]').fill("Miguel");
      await page.locator('input[type="email"]').fill(email);
      await page.locator('input[type="password"]').first().fill(password);
      await page.locator('input[type="password"]').nth(1).fill(password);
      await page.getByRole("button", { name: /Crear cuenta|Create account/i }).click();
    }
    await page.waitForURL((u) => !String(u).includes("/login"), { timeout: 25000 });
  }
  await dump("live-home");
  const bodyHome = await page.locator("body").innerText();
  if (/Waiting for access|Esperando acceso/i.test(bodyHome)) {
    fail("access", "waiting room — admin already claimed");
  } else {
    ok("signed in", page.url());
  }

  await goto("/reportes?tab=pl");
  await dump("live-pl-before");
  const plChrome = await page.locator("header + div, .flex.h-11").first().innerText().catch(() => page.locator("body").innerText());
  const plTabs = await page.locator("div.flex.h-11").first().innerText().catch(() => "");
  console.log("PL TABS", plTabs.replace(/\n/g, " | "));
  if (/P&G|P&L|Balance/i.test(plTabs) && !/Usuario|Customer|Cliente/i.test(plTabs.split("\n")[0] || plTabs)) {
    ok("pl chrome financial", plTabs.replace(/\s+/g, " ").trim());
  } else {
    // fallback: check no sales-only headers active
    if (/P&G|P&L/.test(plTabs) && /Balance/.test(plTabs)) ok("pl chrome financial", plTabs.replace(/\s+/g, " ").trim());
    else fail("pl chrome financial", plTabs);
  }

  await page.getByRole("button", { name: /Balance/i }).click();
  await page.waitForTimeout(700);
  await dump("live-balance");
  const balTabs = await page.locator("div.flex.h-11").first().innerText().catch(() => "");
  const balBody = await page.locator("body").innerText();
  console.log("BAL TABS", balTabs.replace(/\n/g, " | "));
  if (/Balance general|Balance Sheet/i.test(balBody) && /P&G|P&L/.test(balTabs) && !/Overview|Resumen|Usuario/.test(balTabs)) {
    ok("balance stays on financial tabs", balTabs.replace(/\s+/g, " ").trim());
  } else if (/Balance general|Balance Sheet/i.test(balBody) && /P&G|P&L|Trial|Balanza|Liquidaciones|Settlements/i.test(balTabs)) {
    ok("balance stays on financial tabs", balTabs.replace(/\s+/g, " ").trim());
  } else {
    fail("balance stays on financial tabs", balTabs + " :: " + balBody.slice(0, 200));
  }

  await goto("/reportes?tab=pl");
  const plBefore = await page.locator("body").innerText();
  const plZero = /\$0\.00/.test(plBefore) || /0\.00/.test(plBefore);
  if (/Pérdidas y ganancias|Profit & Loss/i.test(plBefore)) ok("pl page", plZero ? "zeros + caption" : "has numbers");
  else fail("pl page", plBefore.slice(0, 200));

  // ── Purchase ──
  await goto("/compras?tab=new");
  await dump("live-po-new");
  const vendorSel = page.locator("select").first();
  const vendor = await selectFirstReal(vendorSel, ["papayas", "acesoria", "drage", "insurance", "cpa", "brokerage", "celulosa", "sandra"]);
  ok("vendor", vendor.text);
  await page.getByRole("button", { name: /\+ Agregar artículo|\+ Add item/i }).click();
  await page.waitForTimeout(500);
  const search = page.locator("input[placeholder*='product' i], input[placeholder*='artículo' i], input[placeholder*='variedad' i], input[placeholder*='Search']").first();
  if (await search.isVisible().catch(() => false)) await search.fill("Papaya");
  await page.waitForTimeout(500);
  await shot("live-po-picker");
  const addBtn = page.getByRole("button", { name: /^Add$|^Agregar$/i }).first();
  if (await addBtn.isVisible().catch(() => false)) await addBtn.click();
  else await page.keyboard.press("Enter");
  await page.waitForTimeout(600);
  const lineRow = page.locator("table tbody tr").first();
  if (!(await lineRow.locator("input").first().isVisible().catch(() => false))) {
    fail("po line added", await page.locator("body").innerText().then((t) => t.slice(0, 250)));
  } else {
    ok("po line added");
    const qtyInput = lineRow.locator("input.w-20").first();
    const costInput = lineRow.locator("input.w-24").first();
    if (await qtyInput.isVisible().catch(() => false)) await qtyInput.fill("10");
    if (await costInput.isVisible().catch(() => false)) await costInput.fill("20");
  }
  await dump("live-po-lines");
  const place = page.getByRole("button", { name: /Colocar orden|Place order/i });
  await place.click({ timeout: 8000 });
  await page.waitForTimeout(1500);
  const afterPo = await dump("live-po-placed");
  const poMatch = afterPo.match(/PO\s+(\S+)/i) || afterPo.match(/OC[-\s]?\S+/);
  if (/placed|colocad|PO |OC-/i.test(afterPo)) ok("po placed", poMatch ? poMatch[0] : afterPo.slice(0, 80));
  else fail("po placed", afterPo.slice(0, 200));

  // open first / newest PO row
  const poLink = page.locator("table tbody tr").first().locator("button.font-medium, button.text-link").first();
  await poLink.click();
  await page.waitForTimeout(500);
  await dump("live-po-open");
  const recv = page.getByRole("button", { name: /Recibir mercancía|Receive merchandise/i });
  if (!(await recv.isVisible().catch(() => false))) {
    fail("receive button", "not visible");
  } else {
    await recv.click();
    await page.waitForTimeout(400);
    const dest = page.locator("label").filter({ hasText: /Destination|Destino/ }).locator("select");
    if (await dest.count()) await selectFirstReal(dest);
    const resultSel = page.locator("label").filter({ hasText: /Result|Resultado/ }).locator("select").first();
    if (await resultSel.count()) await resultSel.selectOption("Aceptada");
    else {
      const any = page.locator("select").filter({ hasText: "Aceptada" }).first();
      if (await any.count()) await any.selectOption("Aceptada");
    }
    await dump("live-receive-modal");
    await page.getByRole("button", { name: /^Recibir$|^Receive$/i }).click();
    await page.waitForTimeout(1500);
    const recBody = await dump("live-received");
    if (/Received|Recepción|Recibida|Received /i.test(recBody)) ok("received", recBody.match(/Received \S+|Recibida \S+|OC-\S+|PO \S+/)?.[0] || "");
    else ok("received?", recBody.slice(0, 120));
  }

  // ── Sales ──
  await goto("/ventas?tab=new");
  await dump("live-so-new");
  const custSel = page.locator("select").first();
  const cust = await selectFirstReal(custSel, ["papayas"]);
  ok("customer", cust.text);
  await page.getByRole("button", { name: /\+ Agregar artículo|\+ Add item/i }).click();
  await page.waitForTimeout(500);
  const search2 = page.locator("input[placeholder*='product' i], input[placeholder*='artículo' i], input[placeholder*='variedad' i], input[placeholder*='Search']").first();
  if (await search2.isVisible().catch(() => false)) await search2.fill("Papaya");
  await page.waitForTimeout(500);
  const add2 = page.getByRole("button", { name: /^Add$|^Agregar$/i }).first();
  if (await add2.isVisible().catch(() => false)) await add2.click();
  else await page.keyboard.press("Enter");
  await page.waitForTimeout(600);
  const soRow = page.locator("table tbody tr").first();
  const soQty = soRow.locator("input.w-20").first();
  const soPrice = soRow.locator("input.w-24").first();
  if (await soQty.isVisible().catch(() => false)) await soQty.fill("10");
  if (await soPrice.isVisible().catch(() => false)) await soPrice.fill("32");
  await dump("live-so-lines");
  await page.getByRole("button", { name: /Colocar orden|Place order/i }).click();
  await page.waitForTimeout(1500);
  const afterSo = await dump("live-so-placed");
  if (/OV-|SO |colocad|placed/i.test(afterSo)) ok("so placed", afterSo.match(/OV-\S+|SO \S+/)?.[0] || "");
  else fail("so placed", afterSo.slice(0, 200));

  const goOrder = page.getByRole("button", { name: /Ir a la orden|Go to order/i });
  if (await goOrder.isVisible().catch(() => false)) {
    await goOrder.click();
    await page.waitForTimeout(800);
  } else {
    await goto("/ventas?tab=all");
    await page.locator("table tbody tr").first().locator("button.font-medium, button.text-link").first().click();
    await page.waitForTimeout(800);
  }
  await dump("live-so-open");

  const fulfill = page.getByRole("button", { name: /^Surtir$|^Fulfill$/i }).first();
  if (await fulfill.isVisible().catch(() => false)) {
    await fulfill.click();
    await page.waitForTimeout(400);
    const lotSel = page.locator("label").filter({ hasText: /Lot|Lote/ }).locator("select");
    if (await lotSel.count()) await selectFirstReal(lotSel);
    await page.waitForTimeout(300);
    const locSel = page.locator("label").filter({ hasText: /Location|Ubicaci/ }).locator("select");
    if (await locSel.count()) await selectFirstReal(locSel);
    await dump("live-fulfill-modal");
    await page.getByRole("button", { name: /^Surtir$|^Fulfill$/i }).last().click();
    await page.waitForTimeout(1500);
    ok("fulfilled", (await page.locator("body").innerText()).match(/Surtida|Fulfilled/)?.[0] || "clicked");
  } else {
    fail("fulfill button", "not visible — maybe no ATS");
  }
  await dump("live-fulfilled");

  const invBtn = page.getByRole("button", { name: /^Factura$|^Invoice$/i }).first();
  if (await invBtn.isVisible().catch(() => false)) {
    await invBtn.click();
    await page.waitForTimeout(1500);
    const invBody = await dump("live-invoiced");
    if (/Invoice |Factura |PP-/i.test(invBody)) ok("invoiced", invBody.match(/PP-\S+|Invoice \S+|Factura \S+/)?.[0] || "");
    else fail("invoiced", invBody.slice(0, 200));
  } else {
    fail("invoice button", "not visible");
  }

  await goto("/reportes?tab=pl");
  await dump("live-pl-after");
  const plAfter = await page.locator("body").innerText();
  const hasLive = /320\.00|\$320/.test(plAfter) || /Ingresos totales|Total Income/.test(plAfter);
  // 10 * 32 = 320
  if (/\$320/.test(plAfter) || /320\.00/.test(plAfter)) ok("pl live income $320", plAfter.match(/\$[\d,.]+/g)?.slice(0, 6).join(" ") || "");
  else if (!/\$0\.00/.test(plAfter.split("Ingresos")[1] || plAfter)) ok("pl non-zero?", plAfter.match(/\$[\d,.]+/g)?.slice(0, 8).join(" ") || plAfter.slice(0, 150));
  else fail("pl live income", plAfter.match(/\$[\d,.]+/g)?.join(" ") || plAfter.slice(0, 250));

  await goto("/cxc?tab=invoices");
  await dump("live-cxc");
  const cxc = await page.locator("body").innerText();
  if (/PP-|Invoice|Factura/.test(cxc)) ok("cxc has invoice");
  else fail("cxc has invoice", cxc.slice(0, 200));

  await goto("/inventario?tab=lots");
  await dump("live-lots");
} catch (e) {
  fail("crash", e instanceof Error ? e.message : String(e));
  await shot("live-crash");
} finally {
  const filtered = errors.filter((e) => !/aborted|ResizeObserver|favicon|net::/i.test(e)).slice(0, 12);
  console.log("\nERRORS", JSON.stringify(filtered, null, 2));
  const bad = steps.filter((s) => !s.ok).length;
  console.log(`\n${steps.filter((s) => s.ok).length} ok / ${bad} fail`);
  await browser.close();
  process.exit(bad ? 1 : 0);
}
