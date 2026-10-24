// Copies the pdf.js worker into /public so the brochure viewer can load it
// from the same origin. Runs automatically after `npm install`.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "node_modules", "pdfjs-dist", "build", "pdf.worker.min.mjs");
const target = join(root, "public", "pdf.worker.min.mjs");

if (!existsSync(source)) {
  console.warn("[copy-pdf-worker] pdfjs-dist is not installed yet; skipping");
  process.exit(0);
}
mkdirSync(dirname(target), { recursive: true });
copyFileSync(source, target);
console.log("[copy-pdf-worker] public/pdf.worker.min.mjs updated");
