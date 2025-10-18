// 👑 DropDrop Scraper v4.0 — Extracción Mejorada de Stock + Href
// Mejoras: múltiples selectores, debug visual, espera dinámica
// Autor: Manuel + GPT-5, 2025-10

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import chalk from 'chalk';
import ora from 'ora';
import cliProgress from 'cli-progress';
import { performance } from 'perf_hooks';

// === CONFIG ===
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const EMAIL = process.env.EMAIL || '';
const PASSWORD = process.env.PASSWORD || '';
const LOGIN_URL = 'https://app.dropi.cl/auth/login';
const STORAGE_FILE = path.join(__dirname, 'auth.json');
const OUT_DIR = path.join(__dirname, 'out');
const DEBUG_SCREENSHOTS = true; // Activar para guardar screenshots de debug
fs.mkdirSync(OUT_DIR, { recursive: true });

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const nowIso = () => new Date().toISOString().replace(/[:.]/g, '-');
const slug = (s) => (s || '').toLowerCase().normalize('NFD')
  .replace(/\p{Diacritic}/gu, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');
const info = (m) => console.log(chalk.cyan(`ℹ️ ${m}`));
const success = (m) => console.log(chalk.green(`✅ ${m}`));
const warn = (m) => console.log(chalk.yellow(`⚠️ ${m}`));
const error = (m) => console.log(chalk.red(`❌ ${m}`));

// === Canvas Sniffer ===
async function addCanvasSniffer(context) {
  await context.addInitScript(() => {
    try {
      const cap = (text, ctx) => {
        const c = ctx?.canvas;
        if (!c) return;
        c.__drawnTexts = c.__drawnTexts || [];
        const s = String(text ?? '');
        if (/[0-9$CLP]/i.test(s)) c.__drawnTexts.push(s);
      };
      const wrap = (proto, fn) => {
        const orig = proto[fn];
        if (!orig || orig.__wrapped__) return;
        proto[fn] = function (...args) {
          if (fn === 'fillText' || fn === 'strokeText') cap(args[0], this);
          return orig.apply(this, args);
        };
        proto[fn].__wrapped__ = true;
      };
      wrap(CanvasRenderingContext2D.prototype, 'fillText');
      wrap(CanvasRenderingContext2D.prototype, 'strokeText');
    } catch {}
  });
}

// === LOGIN ===
async function ensureLogin(context) {
  const page = await context.newPage();
  info('🔐 Iniciando sesión...');
  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  if (await page.$('aside,nav,[class*="sidebar"]')) {
    success('Sesión existente detectada.');
    await page.close();
    return;
  }
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await Promise.any([
    page.click('button[type="submit"]').catch(() => {}),
    page.press('input[type="password"]', 'Enter').catch(() => {})
  ]);
  await page.waitForSelector('aside,nav,[class*="sidebar"]', { timeout: 70000 }).catch(() => null);
  await context.storageState({ path: STORAGE_FILE }).catch(() => {});
  await page.close();
  success('✅ Sesión guardada en auth.json');
}

// === ORDEN Y SCROLL MEJORADO ===
async function ordenarYScroll(page) {
  try {
    await page.evaluate(() => { document.body.style.zoom = '0.4'; });
    await page.waitForSelector('.order-list .dropdown-toggle', { timeout: 8000 });
    await page.click('.order-list .dropdown-toggle', { delay: 200 });
    await sleep(400);
    await page.locator('.dropdown-menu span', { hasText: 'Más recientes' }).click({ delay: 200 });
    success('🔽 Orden configurado en "Más recientes".');
  } catch {
    warn('⚠️ No se encontró el menú de orden.');
  }

  // Esperar a que cargue el primer producto
  await page.waitForSelector('.product-card, app-card-product', { timeout: 10000 }).catch(() => {});
  await sleep(2000); // Espera adicional para lazy load inicial

  let lastHeight = 0, idle = 0;
  while (idle < 25) {
    await page.evaluate(() => window.scrollBy(0, 3000));
    await sleep(1500); // Aumentado para dar tiempo al lazy load
    
    const btn = await page.$('div.container-button:has-text("Mostrar más productos")');
    if (btn) {
      await btn.scrollIntoViewIfNeeded();
      await btn.click({ delay: 100 });
      await sleep(2000); // Más tiempo después del click
    }
    
    const newHeight = await page.evaluate(() => document.body.scrollHeight);
    if (newHeight === lastHeight) idle++;
    else { 
      idle = 0; // Reset contador si hay cambio
      lastHeight = newHeight;
    }
  }
  
  // Scroll final lento para asegurar carga completa
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(1000);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await sleep(2000);
  
  success('📜 Scroll finalizado.');
}

// === GUARDAR HTML DE DEBUG ===
async function saveDebugHTML(page, meta) {
  const html = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.product-card, app-card-product, [class*="product"]'));
    return cards.slice(0, 3).map((c, i) => `
<!-- ========== CARD ${i + 1} ========== -->
${c.outerHTML}
`).join('\n\n');
  });
  
  const debugDir = path.join(OUT_DIR, 'debug');
  fs.mkdirSync(debugDir, { recursive: true });
  fs.writeFileSync(
    path.join(debugDir, `cards_html_${meta.providerId}_${nowIso()}.html`), 
    html, 
    'utf8'
  );
  info('💾 HTML de debug guardado en out/debug/');
}

// === EXTRACTOR DOM MEJORADO ===
async function extractProducts(page, meta) {
  info('🧠 Extrayendo productos desde el DOM...');

  return await page.evaluate(({ meta }) => {
    const $$ = (q, r = document) => Array.from(r.querySelectorAll(q));
    const t = (el) => (el?.textContent || '').trim();
    const moneyRx = /\$\s?\d[\d\.\,]*/g;
    const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();

    const gatherCanvasTexts = (root) => {
      const all = [];
      (root.querySelectorAll('canvas') || []).forEach(c => {
        const txts = c.__drawnTexts || [];
        if (txts.length) all.push(...txts);
      });
      return all.join(' ');
    };

    // Función mejorada para extraer stock
    const extractStock = (card, raw) => {
      // Método 1: Buscar en atributos data-*
      const dataStock = card.getAttribute('data-stock') || 
                       card.querySelector('[data-stock]')?.getAttribute('data-stock');
      if (dataStock) return Number(dataStock);

      // Método 2: Buscar en clases específicas
      const stockEl = card.querySelector('.stock, .stock-count, [class*="stock"]');
      if (stockEl) {
        const stockText = t(stockEl);
        const match = stockText.match(/(\d+)/);
        if (match) return Number(match[1]);
      }

      // Método 3: Buscar en texto con múltiples patrones
      const patterns = [
        /Stock[:\s]*(\d+)/i,
        /Disponible[:\s]*(\d+)/i,
        /Unidades[:\s]*(\d+)/i,
        /(\d+)\s*unidades/i,
        /(\d+)\s*disponibles/i
      ];
      
      for (const pattern of patterns) {
        const match = raw.match(pattern);
        if (match) return Number(match[1]);
      }

      return null;
    };

    // Función mejorada para extraer href y productId
    const extractHrefAndId = (card) => {
      let href = null;
      let productId = null;

      // Método 1: Buscar enlace directo
      const selectors = [
        'a[href*="/product-details/"]',
        'a[href*="/producto/"]',
        'a[href*="/product/"]',
        '[data-product-id]',
        '[onclick*="product"]'
      ];

      for (const sel of selectors) {
        const el = card.querySelector(sel);
        if (el) {
          href = el.href || el.getAttribute('href');
          const dataId = el.getAttribute('data-product-id');
          if (dataId) productId = Number(dataId);
          if (href) break;
        }
      }

      // Método 2: Buscar en HTML completo
      if (!href) {
        const htmlMatch = card.innerHTML.match(/(?:href=["']|routerLink=["'])([^"']*product-details\/\d+[^"']*)/i);
        if (htmlMatch) href = htmlMatch[1];
      }

      // Método 3: Buscar onclick o data attributes
      if (!href) {
        const onclick = card.getAttribute('onclick') || card.querySelector('[onclick]')?.getAttribute('onclick');
        if (onclick) {
          const match = onclick.match(/product-details\/(\d+)|product\/(\d+)/);
          if (match) {
            const id = match[1] || match[2];
            href = `https://app.dropi.cl/dashboard/product-details/${id}`;
          }
        }
      }

      // Normalizar href
      if (href && !href.startsWith('http')) {
        href = href.startsWith('/') ? 
          `https://app.dropi.cl${href}` : 
          `https://app.dropi.cl/${href}`;
      }

      // Extraer productId del href si no lo tenemos
      if (href && !productId) {
        const match = href.match(/product-details\/(\d+)|product\/(\d+)/);
        if (match) productId = Number(match[1] || match[2]);
      }

      return { href, productId };
    };

    const products = [];
    const seen = new Set(); // Para evitar duplicados
    const cards = $('.product-card, app-card-product, [class*="product"]');
    
    console.log(`[DEBUG] Encontradas ${cards.length} tarjetas de productos`);

    for (const card of cards) {
      const name = clean(t(card.querySelector('h3, .title, .tittle-product, [class*="title"]')));
      if (!name) continue;
      
      // Evitar duplicados por nombre + imagen
      const uniqueKey = name + (card.querySelector('img')?.src || '');
      if (seen.has(uniqueKey)) continue;
      seen.add(uniqueKey);

      const provider = meta.providerName;
      const canvasText = gatherCanvasTexts(card);
      const raw = (card.innerText || '') + ' ' + canvasText;

      const prices = raw.match(moneyRx) || [];
      const priceProvider = prices[0] || '';
      const priceSuggested = prices[1] || '';

      const stock = extractStock(card, raw);
      const { href, productId } = extractHrefAndId(card);

      // Debug para los primeros 3 productos
      if (products.length < 3) {
        console.log(`[DEBUG] Producto: ${name}`);
        console.log(`[DEBUG] Stock: ${stock}`);
        console.log(`[DEBUG] Href: ${href}`);
        console.log(`[DEBUG] ID: ${productId}`);
        console.log(`[DEBUG] Raw text sample: ${raw.substring(0, 200)}`);
      }

      // Imagen
      const img = (() => {
        const imgs = Array.from(card.querySelectorAll('img, source'))
          .map(im => im.src || im.getAttribute('src') || im.getAttribute('data-src'))
          .filter(Boolean);
        return imgs.find(s => !/verified|categories_providers|logo|no-image/.test(s)) || imgs[0] || '';
      })();

      products.push({
        ...meta,
        provider,
        name,
        priceProvider,
        priceSuggested,
        stock,
        image: img,
        href,
        productId
      });
    }
    
    return products;
  }, { meta });
}

// === SCRAPER PRINCIPAL ===
async function scrapeProvider(context, url) {
  const start = performance.now();
  const page = await context.newPage();

  try {
    const spinner = ora('Cargando proveedor...').start();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sleep(3000); // Espera adicional para JavaScript
    spinner.succeed('Proveedor cargado.');

    await ordenarYScroll(page);
    
    const meta = await page.evaluate(() => {
      const h = document.querySelector('h1,h2');
      const name = h ? h.innerText.trim() : 'Proveedor';
      const id = Number((location.pathname.match(/provider\/(\d+)/) || [])[1] || 0);
      return { providerName: name, providerId: id, providerUrl: location.href };
    });

    // Screenshot de debug (primeros productos)
    if (DEBUG_SCREENSHOTS) {
      const debugDir = path.join(OUT_DIR, 'debug');
      fs.mkdirSync(debugDir, { recursive: true });
      await page.screenshot({ 
        path: path.join(debugDir, `provider_${meta.providerId}_${nowIso()}.png`),
        fullPage: false 
      });
    }

    // Guardar HTML de las primeras tarjetas para análisis
    await saveDebugHTML(page, meta);

    const products = await extractProducts(page, meta);
    
    // Estadísticas de extracción
    const withStock = products.filter(p => p.stock !== null).length;
    const withHref = products.filter(p => p.href).length;
    const withId = products.filter(p => p.productId).length;
    
    info(`📊 Stats: ${withStock}/${products.length} con stock, ${withHref}/${products.length} con href, ${withId}/${products.length} con ID`);

    const dir = path.join(OUT_DIR, `prov_${meta.providerId}_${slug(meta.providerName)}_${nowIso()}`);
    fs.mkdirSync(dir, { recursive: true });

    fs.writeFileSync(path.join(dir, 'products.json'), JSON.stringify({ 
      meta, 
      count: products.length,
      stats: { withStock, withHref, withId },
      products 
    }, null, 2));
    
    const csvCols = ['providerName','providerId','providerUrl','name','productId','priceProvider','priceSuggested','stock','image','href'];
    const csv = [csvCols.join(',')].concat(products.map(p => csvCols.map(c => JSON.stringify(p[c] ?? '')).join(','))).join('\n');
    fs.writeFileSync(path.join(dir, 'products.csv'), csv, 'utf8');

    const elapsed = ((performance.now() - start) / 1000).toFixed(1);
    const speed = (products.length / (elapsed / 60)).toFixed(1);
    success(`💾 Guardado ${products.length} productos (${meta.providerName}) en ${elapsed}s (${speed} prod/min)`);
  } catch (e) {
    error('❌ Error en scrapeProvider: ' + e.message);
    console.error(e);
  } finally {
    await page.close().catch(() => {});
  }
}

// === MAIN ===
(async () => {
  console.clear();
  console.log(chalk.magentaBright('\n👑 DropDrop Scraper v7.7 — Extracción Mejorada\n-----------------------------------------'));

  const ctxOpts = fs.existsSync(STORAGE_FILE) ? { storageState: STORAGE_FILE } : {};
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext(ctxOpts);
  await addCanvasSniffer(context);
  await ensureLogin(context);

  const providers = fs.readFileSync('providers_urls.txt', 'utf8').split('\n').map(l => l.trim()).filter(Boolean);
  for (const url of providers) {
    console.log(chalk.yellow(`\n➡️ ${url}`));
    await scrapeProvider(context, url);
  }

  await browser.close();
  success('🎯 Finalizado correctamente.');
})();