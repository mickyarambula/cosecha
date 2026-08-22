/** Opening cutover: AR/AP from Ingresos/Egresos, Chase+JEAMS from V8 as of 19-ago. */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const BASE = "http://127.0.0.1:8080";
mkdirSync("/workspace/screenshots", { recursive: true });

const browser = await chromium.launch({ headless: true });
const errors = [];
const result = { errors };

async function shot(page, name) {
  await page.screenshot({ path: `/workspace/screenshots/${name}.png`, fullSize: true, fullPage: true });
}

function dump(page, label) {
  return page.evaluate((l) => {
    const text = document.body?.innerText || "";
    console.log(`\n=== ${l} url=${location.href} ===\n${text.slice(0, 3500)}\n`);
    return { url: location.href, text };
  }, label);
}

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 45000 });
  await page.getByRole("button", { name: /Need an account/i }).click();
  const email = `miguel.opening.${Date.now()}@cosecha.test`;
  await page.getByLabel(/^Name$/i).fill("Miguel");
  await page.getByLabel(/^Email$/i).fill(email);
  await page.getByLabel(/^Password$/i).fill("secret123");
  await page.getByLabel(/Confirm password/i).fill("secret123");
  await page.getByRole("button", { name: /Create account/i }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(1500);

  const home = await dump(page, "opening-home");
  result.homeReceivable = /673,014/.test(home.text);
  result.homePayable = /570,097/.test(home.text);
  result.homeCash = /9,361/.test(home.text);
  result.homeCorte = /8\/19\/2026|19\/08\/2026|19 Aug 2026|Aug 19/i.test(home.text);
  result.homeBooks = /Ingresos/.test(home.text) && /Egresos/.test(home.text);
  result.noSaldosCaption = !/Saldos that day|Saldos ese d[ií]a/.test(home.text);
  result.noOldCash = !/19,066/.test(home.text);
  result.noProgramadaHome = !/PX-72775|PX-72868/.test(home.text);
  await shot(page, "opening-home");

  await page.goto(`${BASE}/cxc?tab=invoices`, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(1000);
  const cxc = await dump(page, "opening-cxc");
  result.ngm247514 = /NGM247514/.test(cxc.text);
  result.ngm248545 = /NGM248545/.test(cxc.text);
  result.papayasAr = /Papayas & More/.test(cxc.text);
  result.openingBadge = /Opening/.test(cxc.text);
  result.noProgramadaCxc = !/PX-72775|PX-72868/.test(cxc.text);
  result.consignacion = /1001/.test(cxc.text) && /1002/.test(cxc.text);
  result.px72715 = /PX-72715/.test(cxc.text) && /34,560/.test(cxc.text) && /9,600/.test(cxc.text);
  result.px72774 = /PX-72774/.test(cxc.text);
  result.carga1525 = /\b1525\b/.test(cxc.text);
  result.noPx72494Cxc = !/PX-72494/.test(cxc.text);
  result.cxcPaidCol = /Paid in/.test(cxc.text);
  await shot(page, "opening-cxc");

  const facturaHref = await page.locator('a[href*="/doc/factura/"]').first().getAttribute("href");
  result.facturaHref = facturaHref;

  await page.goto(`${BASE}/cxp`, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(1000);
  const cxp = await dump(page, "opening-cxp");
  result.lasBrisas = /Las Brisas/.test(cxp.text);
  result.pampa = /Pampa/.test(cxp.text);
  result.papayasAp = /Papayas & More/.test(cxp.text);
  result.omega = /Agricola Omega/.test(cxp.text);
  result.noProgramadaCxp = !/PX-72775|PX-72868/.test(cxp.text);
  result.cxpBalance = /570,097/.test(cxp.text);
  result.px72494Cxp = /PX-72494/.test(cxp.text);
  result.px72715Ap = /PX-72715/.test(cxp.text);
  result.px72774Ap = /PX-72774/.test(cxp.text);
  await shot(page, "opening-cxp");

  await page.goto(`${BASE}/tesoreria`, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(800);
  const cash = await dump(page, "opening-cash");
  result.corteChase = /CORTE-CHASE/.test(cash.text);
  result.chaseName = /JP Morgan Chase|Chase/.test(cash.text);
  result.cashBal = /9,361/.test(cash.text);
  result.noOldTesoreria = !/30 Jun 2026|Saldos — not today's bank/.test(cash.text);
  await shot(page, "opening-cash");

  await page.goto(`${BASE}/reportes?tab=pl`, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(800);
  const pl = await dump(page, "opening-pl");
  result.plNotOpeningSales = !/673,014/.test(pl.text) && !/797,038/.test(pl.text);
  result.plHasSalesAccount = /Sales Revenue/.test(pl.text);
  await shot(page, "opening-pl");

  await page.goto(`${BASE}/reportes?tab=balance`, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(800);
  const bs = await dump(page, "opening-balance");
  result.bsAr = /Accounts Receivable/.test(bs.text) && /673,014/.test(bs.text);
  result.bsAp = /Accounts Payable/.test(bs.text) && /570,097/.test(bs.text);
  result.bsJeams = /JEAMS/.test(bs.text) && /52,447/.test(bs.text);
  result.bsChase = /JP Morgan Chase/.test(bs.text) && /9,361/.test(bs.text);
  result.bsEquity = /59,830/.test(bs.text);
  result.noOldJeams = !/23,030/.test(bs.text);
  result.noOldEquity = !/104,380/.test(bs.text);
  await shot(page, "opening-balance");

  if (facturaHref) {
    await page.goto(`${BASE}${facturaHref}`, { waitUntil: "networkidle", timeout: 45000 });
    await page.waitForTimeout(600);
    const doc = await dump(page, "opening-doc");
    result.publicDoc = /Plein Produce|Invoice|Factura/i.test(doc.text);
    await shot(page, "opening-doc");
  }

  await page.goto(`${BASE}/cuentas?tab=accounts`, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(600);
  const coa = await dump(page, "opening-coa");
  result.coaChase = /JP Morgan Chase/.test(coa.text);
  result.coaJeams = /JEAMS/.test(coa.text);
  result.coaNoWells = !/Wells Fargo/.test(coa.text);
  await shot(page, "opening-coa");
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
  "homeBooks",
  "ngm247514",
  "ngm248545",
  "papayasAr",
  "px72715",
  "px72774",
  "carga1525",
  "noPx72494Cxc",
  "lasBrisas",
  "pampa",
  "papayasAp",
  "px72494Cxp",
  "noProgramadaCxc",
  "noProgramadaCxp",
  "corteChase",
  "bsJeams",
  "bsChase",
  "bsEquity",
  "plNotOpeningSales",
];
const failed = required.filter((k) => !result[k]);
if (errors.length || failed.length) {
  console.error("FAILED", failed, errors);
  process.exit(1);
}
console.log("opening-qa ok");
