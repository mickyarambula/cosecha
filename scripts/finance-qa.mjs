import { chromium } from "playwright";
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push("page:" + e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push("console:" + m.text()); });

async function go(path, name) {
  await page.goto("http://127.0.0.1:8080" + path, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(800);
  const text = await page.locator("body").innerText();
  await page.screenshot({ path: `/workspace/screenshots/${name}.png`, fullPage: true });
  console.log("\n==", name, path, "==");
  console.log("len", text.length);
  console.log(text.slice(0, 500).replace(/\n+/g, " | "));
  return text;
}

const cuentas = await go("/cuentas?tab=accounts", "coa");
const auto = await go("/cuentas?tab=automations", "automations");
const overview = await go("/gastos?tab=overview", "exp-overview");
const list = await go("/gastos?tab=list", "exp-list");
const aging = await go("/gastos?tab=aging", "exp-aging");
const sales = await go("/cxc?tab=overview", "ar-overview");
const invoices = await go("/cxc?tab=invoices", "ar-invoices");
const pl = await go("/reportes?tab=pl", "pl");
const ventas = await go("/ventas?tab=new", "so-new");
const lots = await go("/inventario?tab=lots", "lots");

console.log("\nERRORS", JSON.stringify(errors, null, 2));
const checks = {
  salesRevenue: cuentas.includes("Sales Revenue"),
  ap: cuentas.includes("Accounts Payable"),
  automations: auto.includes("Accounting Automations"),
  unpaid: overview.includes("Unpaid") || overview.includes("TOTAL") || overview.includes("Total expenses"),
  freight: list.includes("Freight") || list.includes("EXP") || list.includes("Purchase Order"),
  plIncome: pl.includes("Income") || pl.includes("Sales Revenue") || pl.includes("Profit"),
  soNew: ventas.includes("Place order") || ventas.includes("Customer"),
};
console.log("CHECKS", checks);
await browser.close();
if (errors.length) process.exit(1);
