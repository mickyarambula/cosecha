import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";

const BASE = "http://127.0.0.1:8080";
mkdirSync("/workspace/screenshots", { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1280, height: 900 },
  acceptDownloads: true,
});
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e}`));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
});

await page.goto(`${BASE}/doc/factura/60`, { waitUntil: "networkidle", timeout: 30000 });
await page.waitForSelector(".doc-sheet", { timeout: 15000 });
const printBtn = page.getByRole("button", { name: /Print \/ PDF|Imprimir \/ PDF/ }).last();
await printBtn.waitFor({ state: "visible" });
await page.screenshot({ path: "/workspace/screenshots/pdf-doc-before.png", fullPage: true });
const numberText = ((await page.locator(".doc-sheet .font-mono").first().textContent()) || "").trim();

const downloadPromise = page.waitForEvent("download", { timeout: 25000 });
await printBtn.click();
let download = null;
let downloadErr = "";
try {
  download = await downloadPromise;
} catch (e) {
  downloadErr = String(e);
}

const toolbar = ((await page.locator(".doc-toolbar").innerText()) || "").slice(0, 400);
const suggested = download ? download.suggestedFilename() : "";
let header = "";
let size = 0;
if (download) {
  const pdfPath = "/workspace/screenshots/invoice-download.pdf";
  await download.saveAs(pdfPath);
  const buf = readFileSync(pdfPath);
  size = buf.length;
  header = buf.slice(0, 8).toString("utf8");
}

await page.screenshot({ path: "/workspace/screenshots/pdf-doc-after.png" });

await page.getByRole("button", { name: /Send \/ WhatsApp|Enviar/ }).first().click();
await page.waitForTimeout(300);
const modalPdf = page.getByRole("dialog").getByRole("button", { name: /Print \/ PDF|Imprimir \/ PDF|Saving PDF|Guardando PDF/ });
const modalHasPdf = (await modalPdf.count()) > 0;
let modalHeader = "";
let modalSize = 0;
let modalName = "";
if (modalHasPdf) {
  const modalDl = page.waitForEvent("download", { timeout: 25000 });
  await modalPdf.click();
  try {
    const d2 = await modalDl;
    modalName = d2.suggestedFilename();
    const p2 = "/workspace/screenshots/invoice-from-send.pdf";
    await d2.saveAs(p2);
    const buf = readFileSync(p2);
    modalSize = buf.length;
    modalHeader = buf.slice(0, 8).toString("utf8");
  } catch (e) {
    downloadErr += ` | modal: ${e}`;
  }
}
await page.screenshot({ path: "/workspace/screenshots/pdf-send-modal.png" });

await browser.close();
const ok = header.startsWith("%PDF") && size > 1000 && errors.length === 0;
console.log(
  JSON.stringify(
    {
      ok,
      numberText,
      suggested,
      header,
      size,
      toolbar,
      downloadErr,
      modalHasPdf,
      modalName,
      modalHeader,
      modalSize,
      errors,
    },
    null,
    2,
  ),
);
process.exit(ok ? 0 : 1);
