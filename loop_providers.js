// ============================================================
// LOOP_PROVIDERS.JS  —  Recorre automáticamente todos los proveedores
// ============================================================

import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ====== CONFIG ======
const PROVIDERS_FILE = path.join(__dirname, "providers_urls.txt");
const SCRAPER = path.join(__dirname, "provider_scrape_login_full_fast_canvas_id.js");
const OUT_DIR = path.join(__dirname, "out");
const LOG_DIR = path.join(__dirname, "logs");

if (!fs.existsSync(PROVIDERS_FILE)) {
  console.error("❌ No se encontró el archivo providers_urls.txt");
  process.exit(1);
}

fs.mkdirSync(LOG_DIR, { recursive: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

// ====== FUNCIONES ======
function log(msg) {
  const time = new Date().toLocaleTimeString("es-CL", { hour12: false });
  console.log(`[${time}] ${msg}`);
}

function readProviders() {
  const content = fs.readFileSync(PROVIDERS_FILE, "utf8");
  return content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
}

async function runScraper(url) {
  return new Promise((resolve) => {
    log(`🟡 Iniciando scrapeo de proveedor: ${url}`);
    const proc = spawn("node", [SCRAPER, url], { stdio: ["ignore", "pipe", "pipe"] });

    const logFile = path.join(LOG_DIR, `log_${Date.now()}.txt`);
    const stream = fs.createWriteStream(logFile);
    proc.stdout.pipe(stream);
    proc.stderr.pipe(stream);

    proc.on("exit", (code) => {
      if (code === 0) {
        log(`✅ Proveedor terminado correctamente (${url})`);
      } else {
        log(`⚠️ Proveedor finalizó con código ${code} (${url})`);
      }
      resolve();
    });
  });
}

// ====== MAIN LOOP ======
(async () => {
  const providers = readProviders();
  if (providers.length === 0) {
    console.log("⚠️ No hay URLs en providers_urls.txt");
    process.exit(0);
  }

  log(`📋 ${providers.length} proveedores listos para procesar.`);
  let count = 0;

  for (const url of providers) {
    count++;
    log(`🚀 (${count}/${providers.length}) Procesando ${url}`);
    await runScraper(url);
    log(`---`);
  }

  log("🎉 Todos los proveedores fueron procesados correctamente.");
})();
