// 👑 DropDrop Scraper v17.0 (Scroll con Activador de Lazy Load) 👑
// - SCROLL DEFINITIVO: Lógica reescrita para centrarse en encontrar y presionar botones/enlaces de "Mostrar más".
// - LÓGICA PERSISTENTE: El bucle de scroll continúa mientras haya un activador de lazy load que presionar.
// - MANTIENE LA ESTRUCTURA Y FIABILIDAD DE LA v16.

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import chalk from 'chalk';
import cliProgress from 'cli-progress';
import { performance } from 'perf_hooks';

// =================================================================
// ================== ⚙️ CONFIGURACIÓN PRINCIPAL ⚙️ ==================
// =================================================================

const CONCURRENCY = 5;
const HEADLESS = true;
const DEBUG_MODE = false;
const STOCK_EXTRACTION_MODE = 'hybrid';
const PARALLEL_STOCK_CHECKS = 8;
const STOCK_TIMEOUT = 15000;

// =================================================================
// =================== 📦 INICIALIZACIÓN Y RUTAS 📦 ===================
// =================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const { EMAIL, PASSWORD } = process.env;
const LOGIN_URL = 'https://app.dropi.cl/auth/login';
const STORAGE_FILE = path.join(__dirname, 'auth.json');
const OUT_DIR = path.join(__dirname, 'out');
fs.mkdirSync(OUT_DIR, { recursive: true });
if (DEBUG_MODE) fs.mkdirSync(path.join(OUT_DIR, 'debug'), { recursive: true });

// =================================================================
// ===================== 🛠️ FUNCIONES AUXILIARES 🛠️ =====================
// =================================================================

const log = { info: (m) => console.log(chalk.cyan(`ℹ️ ${m}`)), success: (m) => console.log(chalk.green(`✅ ${m}`)), warn: (m) => console.log(chalk.yellow(`⚠️ ${m}`)), error: (m) => console.log(chalk.red(`❌ ${m}`)), };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const nowIso = () => new Date().toISOString().replace(/[:.]/g, '-');
const slugify = (s) => (s || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

async function addCanvasSniffer(context) { /* ... (sin cambios) ... */ }
async function ensureLogin(context) { /* ... (sin cambios) ... */ }
async function getStockFromProductPage(page, productUrl) { /* ... (sin cambios) ... */ }
async function getStocksInParallel(context, products) { /* ... (sin cambios) ... */ }
async function saveDebugFiles(page, meta) { /* ... (sin cambios) ... */ }

/**
 * Lógica de scroll completamente nueva, centrada en el activador de lazy load.
 * @param {import('playwright').Page} page
 */
async function ordenarYScroll(page) {
    try {
        await page.evaluate(() => { document.body.style.zoom = '0.4'; });
        await page.locator('.order-list .dropdown-toggle').click({ timeout: 12000 });
        await page.locator('.dropdown-menu span', { hasText: 'Más recientes' }).click({ delay: 200 });
    } catch {}
    await page.waitForSelector('.product-card, app-card-product', { timeout: 15000 }).catch(() => {});
    await sleep(2000);

    // Selector universal para el botón/enlace de "Mostrar más"
    const LAZY_LOAD_SELECTOR = 'button:has-text("Mostrar más"), div:has-text("Mostrar más"), a:has-text("Mostrar más")';
    let consecutiveFailures = 0;
    const maxFailures = 3; // Intentará 3 veces al final antes de rendirse
    let totalClicks = 0;

    while (consecutiveFailures < maxFailures) {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await sleep(1000); // Pequeña espera para que aparezca el botón

        try {
            // Espera hasta 10 segundos para que el botón aparezca y sea clickeable
            await page.locator(LAZY_LOAD_SELECTOR).click({ timeout: 10000 });
            
            // Si el clic tiene éxito, reinicia el contador de fallos
            consecutiveFailures = 0;
            totalClicks++;
            log.info(`🖱️ Botón "Mostrar más" presionado (${totalClicks}). Cargando nuevos productos...`);
            
            // Espera a que la red se calme después del clic, crucial para lazy load
            await page.waitForLoadState('networkidle', { timeout: 15000 });

        } catch (error) {
            // Si el localizador no encuentra el botón después de 10 segundos, cuenta como un fallo
            consecutiveFailures++;
            log.warn(`No se encontró el botón "Mostrar más" (Intento ${consecutiveFailures}/${maxFailures})`);
            
            // Hacemos un último scroll por si acaso
            await page.evaluate(() => window.scrollBy(0, 3000));
            await sleep(2000);
        }
    }

    log.success(`📜 Scroll finalizado. Se presionó el botón "Mostrar más" ${totalClicks} veces.`);
}

// =================================================================
// ================= 🧠 LÓGICA DE EXTRACCIÓN 🧠 =====================
// =================================================================
async function extractProductsDirectly(page) { /* ... (sin cambios) ... */ }


// =================================================================
// ==================== 🏭 PROCESO POR PROVEEDOR 🏭 ====================
// =================================================================
async function scrapeProvider(context, url, progressBar) { /* ... (sin cambios) ... */ }


// =================================================================
// ====================== 🚀 EJECUCIÓN PRINCIPAL 🚀 ======================
// =================================================================
async function main() { /* ... (sin cambios) ... */ }


// --- CÓDIGO COMPLETO (se pegan el resto de funciones sin cambios) ---
addCanvasSniffer = async function(context) { await context.addInitScript(() => { try { const cap = (text, ctx) => { const c = ctx?.canvas; if (!c) return; c.__drawnTexts = c.__drawnTexts || []; const s = String(text ?? '').trim(); if (s) c.__drawnTexts.push(s); }; const wrap = (proto, fn) => { const orig = proto[fn]; if (!orig || orig.__wrapped__) return; proto[fn] = function (...args) { if (fn === 'fillText' || fn === 'strokeText') cap(args[0], this); return orig.apply(this, args); }; proto[fn].__wrapped__ = true; }; wrap(CanvasRenderingContext2D.prototype, 'fillText'); wrap(CanvasRenderingContext2D.prototype, 'strokeText'); } catch {} }); };
ensureLogin = async function(context) { const page = await context.newPage(); log.info('🔐 Verificando sesión...'); try { await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 60000 }); if (await page.locator('aside,nav,[class*="sidebar"]').first().isVisible({ timeout: 5000 })) { log.success('Sesión existente detectada.'); return; } log.warn('Se requiere inicio de sesión. Intentando...'); await page.fill('input[type="email"]', EMAIL); await page.fill('input[type="password"]', PASSWORD); await Promise.all([ page.waitForURL('**/dashboard/**', { timeout: 60000 }), page.locator('button:has-text("Ingresar"), button:has-text("Iniciar sesión"), button[type="submit"]').first().click(), ]); await context.storageState({ path: STORAGE_FILE }); log.success('✅ Sesión iniciada y guardada correctamente.'); } catch (e) { log.error('Falló el proceso de inicio de sesión.'); console.error(e); process.exit(1); } finally { await page.close(); } };
getStockFromProductPage = async function(page, productUrl) { try { await page.goto(productUrl, { waitUntil: 'domcontentloaded', timeout: STOCK_TIMEOUT }); await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(()=>{}); return await page.evaluate(() => { const text = document.body.innerText; const patterns = [/Stock[:\s]+(\d+)/i, /Disponible[:\s]+(\d+)/i, /(\d+)\s+unidades/i]; for (const p of patterns) { const m = text.match(p); if (m) return parseInt(m[1] || m[0].match(/\d+/)[0], 10); } return null; }); } catch (e) { return null; } };
getStocksInParallel = async function(context, products) { const toUpdate = products.filter(p => p.href); if (toUpdate.length === 0) return; for (let i = 0; i < toUpdate.length; i += PARALLEL_STOCK_CHECKS) { const chunk = toUpdate.slice(i, i + PARALLEL_STOCK_CHECKS); await Promise.all(chunk.map(async (product) => { const page = await context.newPage(); await page.route('**/*', (route) => { if (['image','stylesheet','font'].includes(route.request().resourceType())) route.abort(); else route.continue(); }); try { const stock = await getStockFromProductPage(page, product.href); if (stock !== null) product.stock = stock; } finally { await page.close(); } })); } };
saveDebugFiles = async function(page, meta) { const debugDir = path.join(OUT_DIR, 'debug'); await page.screenshot({ path: path.join(debugDir, `screenshot_${meta.providerId}_${nowIso()}.png`), fullPage: false }); const html = await page.evaluate(() => Array.from(document.querySelectorAll('.product-card')).slice(0, 3).map((c, i) => `\n${c.outerHTML}`).join('\n\n')); fs.writeFileSync(path.join(debugDir, `cards_${meta.providerId}_${nowIso()}.html`), html, 'utf8'); };
extractProductsDirectly = async function(page) { const CARD_SELECTOR = '.product-card, app-card-product, [class*="product-card-"]'; await page.waitForSelector(CARD_SELECTOR, { timeout: 20000 }); const productCardLocators = await page.locator(CARD_SELECTOR).all(); const products = []; const seen = new Set(); for (const cardLocator of productCardLocators) { const productData = await cardLocator.evaluate(node => { const t = (el) => (el?.textContent || '').trim(); const clean = (s) => (s || '').replace(/\s+/g, ' ').trim(); const NAME_SELECTOR = 'h3, .title, .tittle-product, .product-name, [class*="product-title"]'; const IMAGE_SELECTOR = 'img, source'; const CATEGORY_SELECTOR = '.category-stock > div:first-child, [class*="category-name"], .category'; const STOCK_CANVAS_SELECTOR = '.stock-container canvas, [class*="stock"] canvas'; const name = clean(t(node.querySelector(NAME_SELECTOR))); if (!name) return null; const image = (() => { const imgs = Array.from(node.querySelectorAll(IMAGE_SELECTOR)).map(im => im.src || im.getAttribute('src')).filter(Boolean); return imgs.find(s => !/verified|logo|no-image/.test(s)) || imgs[0] || ''; })(); const categoryElement = node.querySelector(CATEGORY_SELECTOR); const category = categoryElement ? clean(t(categoryElement)) : 'Sin Categoría'; let stock = null; const canvasEl = node.querySelector(STOCK_CANVAS_SELECTOR); let canvasText = ''; if (canvasEl && canvasEl.__drawnTexts && canvasEl.__drawnTexts.length > 0) { canvasText = canvasEl.__drawnTexts.join(' '); const match = canvasText.match(/\d+/); if (match) stock = parseInt(match[0], 10); } const combinedText = (node.innerText || '') + ' ' + canvasText; const prices = combinedText.match(/\$\s?\d[\d\.\,]*/g) || []; const extractIdAndHrefFromImage = (imgSrc, name) => { if (!imgSrc) return { productId: null, href: null }; const m = imgSrc.match(/\/products\/(\d+)\//); if (m) { const id = parseInt(m[1], 10); const slug = name.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9]+/g, '-'); return { productId: id, href: `https://app.dropi.cl/dashboard/product-details/${id}/${slug}` }; } return { productId: null, href: null }; }; let { productId, href } = extractIdAndHrefFromImage(image, name); if (!href) { const link = node.querySelector('a[href*="/product-details/"]'); if (link) { href = link.href; const m = href.match(/product-details\/(\d+)/); if (m) productId = parseInt(m[1], 10); } } return { name, category, image, priceProvider: prices[0] || '', priceSuggested: prices[1] || '', stock, href, productId }; }); if (!productData) continue; const key = productData.name + productData.image; if (seen.has(key)) continue; seen.add(key); products.push(productData); } return products; };
scrapeProvider = async function(context, url, progressBar) { const page = await context.newPage(); page.on('console', msg => { if (msg.text().includes('[DEBUG-PAGE]')) { log.warn(msg.text()); } }); await page.route('**/*', (route) => { if (['image', 'stylesheet', 'font', 'media'].includes(route.request().resourceType())) route.abort(); else route.continue(); }); let meta = { providerName: url.split('/').pop() || 'unknown', providerId: 'N/A' }; try { await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 }); await ordenarYScroll(page); meta = await page.evaluate((url) => ({ providerName: document.querySelector('h1,h2')?.innerText.trim() || 'Desconocido', providerId: parseInt((location.pathname.match(/provider\/(\d+)/) || [])[1] || 0), providerUrl: url }), url); const productsData = await extractProductsDirectly(page); const products = productsData.map(p => ({ ...meta, ...p })); log.info(`Extracción directa: ${products.length} productos para ${meta.providerName}.`); if (DEBUG_MODE) await saveDebugFiles(page, meta); if (STOCK_EXTRACTION_MODE === 'hybrid') { const toUpdate = products.filter(p => p.stock === null || isNaN(p.stock)); if (toUpdate.length > 0) { log.info(`Modo híbrido buscará ${toUpdate.length} stocks faltantes.`); await getStocksInParallel(context, toUpdate); } } const dir = path.join(OUT_DIR, `prov_${meta.providerId}_${slugify(meta.providerName)}`); fs.mkdirSync(dir, { recursive: true }); const timestamp = nowIso(); fs.writeFileSync(path.join(dir, `products_${timestamp}.json`), JSON.stringify({ meta, count: products.length, products }, null, 2)); const csvCols = ['providerName', 'providerId', 'productId', 'name', 'category', 'priceProvider', 'priceSuggested', 'stock', 'image', 'href']; const csvHeader = csvCols.join(','); const csvRows = products.map(p => csvCols.map(col => JSON.stringify(p[col] ?? '')).join(',')); fs.writeFileSync(path.join(dir, `products_${timestamp}.csv`), [csvHeader, ...csvRows].join('\n'), 'utf8'); } catch (e) { log.error(`Falló ${meta.providerName}: ${e.message.split('\n')[0]}`); } finally { await page.close(); progressBar.increment({ provider: slugify(meta.providerName).substring(0, 25) }); } };
main = async function() { console.clear(); log.info(`👑 DropDrop Scraper v17.0 (Lazy Load Activator | ${CONCURRENCY} trab.) 👑`); const browser = await chromium.launch({ headless: HEADLESS }); const context = await browser.newContext(fs.existsSync(STORAGE_FILE) ? { storageState: STORAGE_FILE } : {}); await addCanvasSniffer(context); await ensureLogin(context); const providers = fs.readFileSync('providers_urls.txt', 'utf8').split('\n').map(l => l.trim()).filter(Boolean); log.info(`Encontrados ${providers.length} proveedores para scrapear.`); const progressBar = new cliProgress.SingleBar({ format: `Scrapeando | ${chalk.cyan('{bar}')} | {percentage}% || {value}/{total} Proveedores | Actual: {provider}`, barCompleteChar: '\u2588', barIncompleteChar: '\u2591', hideCursor: true }); progressBar.start(providers.length, 0, { provider: "Iniciando..." }); const providerQueue = [...providers]; const activeTasks = []; const startTime = performance.now(); const runNextProvider = async () => { const url = providerQueue.shift(); if (!url) return; await scrapeProvider(context, url, progressBar); await runNextProvider(); }; for (let i = 0; i < CONCURRENCY; i++) { activeTasks.push(runNextProvider()); } await Promise.all(activeTasks); progressBar.stop(); const endTime = performance.now(); const totalTime = ((endTime - startTime) / 1000 / 60).toFixed(2); log.success(`🎯 Proceso completado en ${totalTime} minutos.`); await browser.close(); };
main().catch(err => { console.error(err); process.exit(1); });