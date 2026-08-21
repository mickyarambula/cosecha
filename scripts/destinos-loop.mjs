#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const BASE = "http://127.0.0.1:8080";
const OUT = "/workspace/screenshots";
mkdirSync(OUT, { recursive: true });
const steps = [];
const ok = (n, x = "") => {
  steps.push({ n, ok: true });
  console.log(`✓ ${n}${x ? " — " + x : ""}`);
};
const fail = (n, x = "") => {
  steps.push({ n, ok: false });
  console.error(`✗ ${n}${x ? " — " + x : ""}`);
};

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.setDefaultTimeout(20000);
const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });

try {
  await page.goto(`${BASE}/destinos`, { waitUntil: "networkidle" });
  await page.getByText("Bodega McAllen").first().waitFor();
  const body = await page.innerText("body");
  if (/Bodega McAllen/.test(body) && /Bodega Nogales/.test(body) && /Northgate DC Anaheim/.test(body) && /Cross-dock Pharr/.test(body)) {
    ok("destinos semilla McAllen/Nogales/Northgate/Pharr");
  } else fail("destinos semilla", body.slice(0, 500));
  await shot("destinos");

  await page.goto(`${BASE}/listas`, { waitUntil: "networkidle" });
  await page.getByText("Carton").first().waitFor();
  const ltxt = await page.innerText("body");
  if (/Carton/.test(ltxt) && /10 ct/.test(ltxt) && /Fancy/.test(ltxt)) ok("listas empaque/calibre/grado");
  else fail("listas", ltxt.slice(0, 400));
  await shot("listas");

  await page.getByPlaceholder("20 ct").fill("20 ct");
  await page.getByRole("button", { name: "Agregar" }).nth(1).click();
  await page.getByText(/20 ct/).first().waitFor({ timeout: 10000 });
  ok("agregar calibre 20 ct");
  await shot("listas-20ct");
} catch (e) {
  fail("crash", e instanceof Error ? e.message : String(e));
  await shot("destinos-crash");
} finally {
  await browser.close();
  const bad = steps.filter((s) => !s.ok).length;
  console.log(`\n${steps.filter((s) => s.ok).length} ok / ${bad} fail`);
  process.exit(bad ? 1 : 0);
}
