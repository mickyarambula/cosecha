#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const BASE = "http://127.0.0.1:8080";
const OUT = "/workspace/screenshots";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.setDefaultTimeout(25000);
page.addInitScript(() => {
  localStorage.setItem("cosecha-prefs", JSON.stringify({ state: { theme: "light", locale: "es" }, version: 0 }));
});

async function dump(name) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  const text = ((await page.locator("body").innerText().catch(() => "")) || "").replace(/\n+/g, " | ").slice(0, 900);
  console.log(`\n=== ${name} ${page.url()} ===\n${text}\n`);
  return text;
}

const steps = [];
function ok(name, extra = "") {
  steps.push({ name, ok: true, extra });
  console.log(`✓ ${name}${extra ? " — " + extra : ""}`);
}
function fail(name, extra = "") {
  steps.push({ name, ok: false, extra });
  console.error(`✗ ${name}${extra ? " — " + extra : ""}`);
}

try {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(400);
  if (page.url().includes("/login")) {
    await page.locator('input[type="email"]').fill("miguelarambulam@gmail.com");
    await page.locator('input[type="password"]').first().fill("Cosecha!miguel1");
    await page.getByRole("button", { name: /^Entrar$|^Sign in$/i }).click();
    await page.waitForURL((u) => !String(u).includes("/login"), { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(800);
  }
  if (page.url().includes("/login")) throw new Error("login failed");
  ok("signed in");

  const wipe = await page.evaluate(async () => {
    const m = await import("/src/lib/produce-server.ts");
    return await m.revertLiveDemo();
  });
  console.log("WIPE", JSON.stringify(wipe));
  if (wipe?.ok) ok("wiped demo", JSON.stringify(wipe));
  else fail("wiped demo", JSON.stringify(wipe));

  await page.goto(`${BASE}/compras?tab=all`, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  const compras = await dump("wipe-compras");
  if (/OC-001/.test(compras)) fail("oc-001 gone", "still listed");
  else ok("oc-001 gone");

  await page.goto(`${BASE}/ventas?tab=all`, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  const ventas = await dump("wipe-ventas");
  if (/OV-001/.test(ventas)) fail("ov-001 gone", "still listed");
  else ok("ov-001 gone");

  await page.goto(`${BASE}/cxc?tab=invoices`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const cxc = await dump("wipe-cxc");
  if (/PP-2026-0001/.test(cxc)) fail("live invoice gone", "PP-2026-0001 still listed");
  else ok("live invoice gone");

  await page.goto(`${BASE}/reportes?tab=pl`, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  const pl = await dump("wipe-pl");
  if (/\$320/.test(pl) && /Sales Revenue\$320/.test(pl)) fail("pl back to corte", pl.slice(0, 200));
  else ok("pl back to corte");

  await page.goto(`${BASE}/cxc?tab=invoices`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  const sendBtn = page.getByRole("button", { name: /Enviar|WhatsApp/i }).first();
  if (await sendBtn.isVisible().catch(() => false)) {
    await sendBtn.click();
    await page.waitForTimeout(400);
    await dump("wipe-send-modal");
    const heading = await page.getByRole("heading", { name: /Enviar documentos|Send documents/i }).isVisible().catch(() => false);
    const outlook = await page.getByRole("button", { name: /Abrir Outlook|Open Outlook/i }).isVisible().catch(() => false);
    const help = (await page.locator("body").innerText()).includes("Cosecha no envía") || (await page.locator("body").innerText()).includes("does not send");
    if (heading && outlook) ok("send modal outlook", help ? "copy ok" : "missing help");
    else fail("send modal outlook", `heading=${heading} outlook=${outlook}`);
    await page.getByRole("button", { name: /Close|Cerrar/i }).first().click().catch(async () => {
      await page.keyboard.press("Escape");
    });
    await page.waitForTimeout(300);
    const still = await page.getByRole("heading", { name: /Enviar documentos|Send documents/i }).isVisible().catch(() => false);
    if (still) fail("modal closes");
    else ok("modal closes");
  } else {
    fail("send button on invoices");
  }
} catch (e) {
  fail("crash", e instanceof Error ? e.message : String(e));
  await dump("wipe-crash");
} finally {
  await browser.close();
  const bad = steps.filter((s) => !s.ok).length;
  console.log(`\n${steps.filter((s) => s.ok).length} ok / ${bad} fail`);
  process.exit(bad ? 1 : 0);
}
