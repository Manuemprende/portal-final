// dropdrop_scraper_1000.js
// ─────────────────────────────────────────────────────────────────────────────
// Multi-país + master consolidado + href/productId robusto + country en CSV.
// - Inicia sesión por país (EMAIL_XX, PASSWORD_XX, LOGIN_URL_XX).
// - Lee /providers/providers_XX.txt (uno por país) y también proveedores genéricos.
// - Guarda JSON/CSV por proveedor: /out/prov_<id>_<slug>_<ts>/{products.json,products.csv}
// - Consolida al final: /out/master/master_<ts>.{json,csv}
// - Env: HEADLESS=true/false, CLEANUP_OUT=true/false
// - NUEVO: Si INGEST_AFTER_RUN=1 ⇒ dispara ingest_supabase.js automáticamente al final
// ─────────────────────────────────────────────────────────────────────────────

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import chalk from 'chalk';
import cliProgress from 'cli-progress';
import { spawn } from 'child_process'; // ← NUEVO

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const HEADLESS    = String(process.env.HEADLESS ?? 'true').toLowerCase() === 'true';
const CLEANUP_OUT = String(process.env.CLEANUP_OUT ?? 'false').toLowerCase() === 'true';

const OUT_DIR     = path.join(__dirname, 'out');
const MASTER_DIR  = path.join(OUT_DIR, 'master');
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(MASTER_DIR, { recursive: true });

const sleep  = (ms)=>new Promise(r=>setTimeout(r,ms));
const nowIso = ()=> new Date().toISOString().replace(/[:.]/g,'-');
const slug   = (s)=>(s||'').toLowerCase().normalize('NFD')
  .replace(/\p{Diacritic}/gu,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');

const info    = (m)=>console.log(chalk.cyan(`ℹ️ ${m}`));
const success = (m)=>console.log(chalk.green(`✅ ${m}`));
const warn    = (m)=>console.log(chalk.yellow(`⚠️ ${m}`));
const error   = (m)=>console.log(chalk.red(`❌ ${m}`));

// ─────────────────────────────────────────────────────────────────────────────
// Países / helpers de país (igual)
// ─────────────────────────────────────────────────────────────────────────────
const ISO2 = ['CL','CO','MX','PA','EC','PE','PY','AR','GT','ES','HN','NI','DO','SV','US','UY','VE','BO','CR'];
const SYN  = { PN:'PA', GUT:'GT' };

function normCC(cc='') { const v=(cc||'').toUpperCase(); return SYN[v]||v; }

function detectCountryFromStrings(...parts) {
  const s = (parts.filter(Boolean).join(' ') || '').toLowerCase();
  const m = s.match(/\/(chile|colombia|mexico|panama|ecuador|peru|paraguay|argentina|guatemala|espana)\//);
  if (m) return m[1];
  if (/\.(cl)\b/.test(s)) return 'chile';
  if (/\.(co)\b/.test(s)) return 'colombia';
  if (/\.(mx)\b/.test(s)) return 'mexico';
  if (/\.(pa)\b/.test(s)) return 'panama';
  if (/\.(ec)\b/.test(s)) return 'ecuador';
  if (/\.(pe)\b/.test(s)) return 'peru';
  if (/\.(py)\b/.test(s)) return 'paraguay';
  if (/\.(ar)\b/.test(s)) return 'argentina';
  if (/\.(gt)\b/.test(s)) return 'guatemala';
  if (/\.(es)\b/.test(s)) return 'espana';
  return null;
}

function ccFromDomain(u='') {
  try {
    const host = new URL(u).hostname;
    if (host.endsWith('.cl')) return 'CL';
    if (host.endsWith('.co')) return 'CO';
    if (host.endsWith('.mx')) return 'MX';
    if (host.endsWith('.pa')) return 'PA';
    if (host.endsWith('.ec')) return 'EC';
    if (host.endsWith('.pe')) return 'PE';
    if (host.endsWith('.py')) return 'PY';
    if (host.endsWith('.ar')) return 'AR';
    if (host.endsWith('.gt')) return 'GT';
    if (host.endsWith('.es')) return 'ES';
  } catch {}
  return null;
}

// ===== Regex/funciones para href y productId (ampliado) =====
const PRODUCT_ID_REGEXES = [
  /\/product-details\/(\d+)(?:[/?]|$)/i,
  /[?&](?:productId|id)=(\d+)/i,
  /\/products?\/(\d+)(?:[/?]|$)/i,
  /\/product\/(\d+)(?:[/?]|$)/i,
];

function absoluteHref(href, baseOrigin) {
  if (!href) return null;
  try { return new URL(href, baseOrigin).toString(); } catch { return null; }
}

function parseProductIdFromHref(href) {
  if (!href) return null;
  for (const re of PRODUCT_ID_REGEXES) {
    const m = href.match(re);
    if (m && m[1]) return Number(m[1]);
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// .env por país, carga de URLs, canvas sniffer, login, ordenar, scroll
// (SIN CAMBIOS estructurales, se mantiene tu lógica original)
// ─────────────────────────────────────────────────────────────────────────────
function loadCountryConfigs() {
  const list = [];
  for (const cc of ISO2) {
    const E = process.env[`EMAIL_${cc}`];
    const P = process.env[`PASSWORD_${cc}`];
    const L = process.env[`LOGIN_URL_${cc}`];
    if (E && P && L) list.push({ cc, email: E, password: P, loginUrl: L, storage: `auth_${cc}.json` });
  }
  if (list.length === 0) {
    const E = process.env.EMAIL;
    const P = process.env.PASSWORD;
    const L = process.env.LOGIN_URL || 'https://app.dropi.cl/auth/login';
    if (E && P) list.push({ cc: 'CL', email: E, password: P, loginUrl: L, storage: 'auth_CL.json' });
  }
  return list;
}

function loadProviderUrlsForCountry(cc) {
  const baseDir      = path.resolve(process.cwd());
  const providersDir = path.join(baseDir, 'providers');
  const urls         = new Set();

  const byCC    = `providers_${cc}.txt`;
  const ccFile  = path.join(providersDir, byCC);
  if (fs.existsSync(ccFile)) {
    const content = fs.readFileSync(ccFile, 'utf8');
    content.split(/\r?\n/).map(l=>l.trim()).filter(Boolean).forEach(u=>urls.add(u));
  }

  if (urls.size === 0 && fs.existsSync(providersDir)) {
    const files = fs.readdirSync(providersDir).filter(f => f.toLowerCase().endsWith('.txt'));
    for (const f of files) {
      const content = fs.readFileSync(path.join(providersDir, f), 'utf8');
      content.split(/\r?\n/).map(l=>l.trim()).filter(Boolean).forEach(u=>urls.add(u));
    }
  }

  const fallback = path.join(baseDir, 'providers_urls.txt');
  if (urls.size === 0 && fs.existsSync(fallback)) {
    const content = fs.readFileSync(fallback, 'utf8');
    content.split(/\r?\n/).map(l=>l.trim()).filter(Boolean).forEach(u=>urls.add(u));
  }

  const filtered = Array.from(urls).filter(u=>{
    const dcc = ccFromDomain(u);
    return !dcc || dcc === cc;
  });

  return filtered;
}

async function addCanvasSniffer(context){
  await context.addInitScript(()=>{
    try{
      const cap=(text,ctx)=>{
        const c = ctx && ctx.canvas;
        if(!c) return;
        if(!c.__drawnTexts) c.__drawnTexts=[];
        const s = String(text ?? '');
        if (s) c.__drawnTexts.push(s);
      };
      const wrap=(proto,fn)=>{
        const orig=proto[fn];
        if(!orig || orig.__wrapped__) return;
        proto[fn]=function(...args){
          if(fn==='fillText' || fn==='strokeText') cap(args[0], this);
          return orig.apply(this,args);
        };
        proto[fn].__wrapped__=true;
      };
      wrap(CanvasRenderingContext2D.prototype,'fillText');
      wrap(CanvasRenderingContext2D.prototype,'strokeText');
    }catch{}
  });
}

async function ensureLogin(context, { email, password, loginUrl, storage }){
  const page = await context.newPage();
  info(`🔐 Verificando sesión (${loginUrl})…`);
  await page.goto(loginUrl, { waitUntil:'domcontentloaded', timeout:60000 });

  if (await page.$('aside,nav,[class*="sidebar"],header,[data-role="sidebar"]')){
    success('Sesión existente detectada.');
    await context.storageState({path:path.join(__dirname, storage)}).catch(()=>{});
    await page.close(); return;
  }

  await page.fill('input[name="email"], input#email, input[type="email"]', email);
  await page.fill('input[name="password"], input#password, input[type="password"]', password);
  await Promise.any([
    page.click('form button[type="submit"], button:has-text("Iniciar"), button:has-text("Ingresar"), button:has-text("Login")').catch(()=>{}),
    page.press('input[type="password"]','Enter').catch(()=>{})
  ]);

  await page.waitForSelector('aside,nav,[class*="sidebar"],header,[data-role="sidebar"]', { timeout:70000 }).catch(()=>null);
  await context.storageState({path:path.join(__dirname, storage)}).catch(()=>{});
  await page.close();
  success('✅ Sesión iniciada y guardada.');
}

async function ordenarPorRecientes(page){
  try{
    await page.evaluate(()=>{ document.body.style.zoom='0.4'; });
    await page.waitForSelector('.order-list .dropdown-toggle', {timeout:12000});
    await page.click('.order-list .dropdown-toggle', { delay:150 });
    await sleep(400);
    await page.locator('.dropdown-menu span', { hasText: 'Más recientes' }).click({ delay:150 });
    await page.waitForLoadState('networkidle', { timeout:4000 }).catch(()=>{});
    success('🔽 Orden: "Más recientes"');
  }catch{
    warn('No encontré el menú de orden. Sigo…');
  }
}

async function scrollConMostrarMas(page, maxNoGrowth=18){
  info('📜 Scroll + "Mostrar más productos"…');
  let lastHeight = 0, noGrowth = 0, clicks = 0, total = 0;

  const bar = new cliProgress.SingleBar({
    format: ' {bar} {percentage}% | Cards: {value} | Clicks: {clicks}',
    barCompleteChar:'█', barIncompleteChar:'░', hideCursor:true
  }, cliProgress.Presets.shades_classic);
  bar.start(100, 0, { clicks });

  await page.waitForSelector('.product-card, app-card-product, [data-product-row], .card-box', {timeout:15000}).catch(()=>{});
  await sleep(1500);

  while (noGrowth < maxNoGrowth){
    await page.evaluate(()=>window.scrollBy(0, 2800));
    await sleep(900);

    const btn = await page.$('div.container-button:has-text("Mostrar más productos"), button:has-text("Mostrar más productos")');
    if (btn){
      await btn.scrollIntoViewIfNeeded().catch(()=>{});
      await btn.click({ delay:80 }).catch(()=>{});
      clicks++;
      await page.waitForLoadState('networkidle',{timeout:2500}).catch(()=>{});
      await sleep(600);
    }

    const newH = await page.evaluate(()=>document.body.scrollHeight);
    const count = await page.$$eval('.product-card, app-card-product, [data-product-row], .card-box', els=>els.length);
    total = Math.max(total, count);

    if (newH === lastHeight) noGrowth++; else { lastHeight = newH; noGrowth = 0; }

    const pct = Math.min(100, Math.round((noGrowth / maxNoGrowth) * 100));
    bar.update(pct, { value: total, clicks });
  }

  await page.evaluate(()=>window.scrollTo(0, document.body.scrollHeight));
  await sleep(800);

  bar.update(100, { value: total, clicks });
  bar.stop();
  success(`📜 Scroll fin. Tarjetas: ${total}, clics "Mostrar más": ${clicks}`);
  return total;
}

// ─────────────────────────────────────────────────────────────────────────────
// EXTRACCIÓN (mejorada con fallbacks para href/productId)
// ─────────────────────────────────────────────────────────────────────────────
async function extractProducts(page, meta){
  info('🧠 Extrayendo productos del DOM…');
  const baseOrigin = new URL(page.url()).origin;

  const products = await page.evaluate(({ meta, baseOrigin, PRODUCT_ID_REGEXES })=>{
    const $$=(q,r=document)=>Array.from(r.querySelectorAll(q));
    const t =(el)=> (el?.textContent||'').replace(/\s+/g,' ').trim();
    const clean=(s)=> (s||'').replace(/\s+/g, ' ').trim();

    const moneyRx = /(?:\$|\bCLP\b|\bMXN\b|\bCOP\b|\bPEN\b|\bPYG\b)\s*\d[\d\.\,]*/gi;
    const unique = (arr)=> Array.from(new Set(arr.filter(Boolean)));

    const canvasTexts=(root)=>{
      const canv=Array.from(root.querySelectorAll('canvas'));
      const all=[];
      for(const c of canv){ if(c.__drawnTexts && c.__drawnTexts.length) all.push(...c.__drawnTexts); }
      return all.join(' ');
    };

    const getCategory=(card)=>{
      const sel = '.category-stock > div:first-child, [class*="category-name"], .category, .chips-container .chip';
      const el = card.querySelector(sel);
      const c1 = clean(t(el));
      if (c1) return c1;
      const chip = card.querySelector('.chips-container .chip');
      return clean(t(chip)) || 'Sin Categoría';
    };

    const getProviderFromCard = (card) => {
      const pn = card.querySelector('.provider-data .provider-name, .provider-name');
      const v = clean(t(pn));
      return v || meta.providerName;
    };

    const getImage=(card)=>{
      const imgs = Array.from(card.querySelectorAll('img, source'))
        .map(im=> im.src || im.getAttribute('src') || im.getAttribute('data-src'))
        .filter(Boolean);
      // evita logos/badges comunes que no son del producto
      const good = imgs.find(s=>!/verified|categories_providers|logo|no-image|badges\/premium/i.test(s));
      return good || imgs[0] || '';
    };

    const abs = (href)=>{ try { return new URL(href, baseOrigin).toString(); } catch { return null; } };

    const productIdFromHref=(href)=>{
      if(!href) return null;
      for (const s of PRODUCT_ID_REGEXES){
        const re = new RegExp(s, 'i');
        const m = href.match(re);
        if (m && m[1]) return Number(m[1]);
      }
      return null;
    };

    // NUEVO: barrido profundo de href/productId
    const robustHrefAndId=(card)=>{
      // 1) Enlaces “obvios”
      let link = card.querySelector('a[href*="/product-details/"], a[href*="/dashboard/product"], a[href*="/product"]');
      if (link){
        const raw = link.href || link.getAttribute('href');
        const href = abs(raw);
        const productId = productIdFromHref(href);
        if (href && productId) return { href, productId };
      }

      // 2) Cualquier <a> interno que matchee los regex
      const anchors = Array.from(card.querySelectorAll('a[href]'));
      for (const a of anchors){
        const raw = a.href || a.getAttribute('href') || '';
        const href = abs(raw);
        const productId = productIdFromHref(href);
        if (productId) return { href, productId };
      }

      // 3) routerLink / ng-reflect-router-link
      const rlEl = card.querySelector('[routerlink], [ng-reflect-router-link]');
      if (rlEl){
        const rl = rlEl.getAttribute('routerlink') || rlEl.getAttribute('ng-reflect-router-link') || '';
        const href = abs(rl);
        const productId = productIdFromHref(href);
        if (href && productId) return { href, productId };
      }

      // 4) onclick con id
      const onclick = card.getAttribute('onclick') || (card.querySelector('[onclick]')?.getAttribute('onclick')) || '';
      const mo = onclick && onclick.match(/product-details\/(\d+)|product\/(\d+)/i);
      if (mo){
        const id = Number(mo[1]||mo[2]);
        return { href: abs(`/dashboard/product-details/${id}`), productId:id };
      }

      // 5) data-* o ids
      const dataId =
        card.getAttribute('data-product-id') ||
        card.getAttribute('data-id') ||
        card.querySelector('[data-product-id]')?.getAttribute('data-product-id') ||
        card.querySelector('[data-id]')?.getAttribute('data-id') ||
        card.getAttribute('ng-reflect-product-id') ||
        card.querySelector('[ng-reflect-product-id]')?.getAttribute('ng-reflect-product-id') ||
        (card.id && card.id.startsWith('product_') ? card.id.replace('product_','') : null);

      if (dataId && /^\d+$/.test(String(dataId))){
        const id = Number(dataId);
        return { href: abs(`/dashboard/product-details/${id}`), productId: id };
      }

      // 6) REGEX sobre outerHTML por si viene embebido en una plantilla Angular
      const html = card.outerHTML || '';
      const rx = /(?:\/dashboard)?\/product-details\/(\d+)(?:[/?"]|$)/i;
      const m = html.match(rx);
      if (m && m[1]){
        const id = Number(m[1]);
        return { href: abs(`/dashboard/product-details/${id}`), productId: id };
      }

      return { href:null, productId:null };
    };

    const hrefAndIdByImage=(imgSrc, name)=>{
      if (!imgSrc) return { href:null, productId:null };
      const m = imgSrc.match(/\/products\/(\d+)\//i);
      if (m){
        const id = Number(m[1]);
        const slug = (name||'').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
        return { href: abs(`/dashboard/product-details/${id}/${slug}`), productId:id };
      }
      return { href:null, productId:null };
    };

    const extractStock=(card, raw)=>{
      const c = card.querySelector('.stock-container canvas, [class*="stock"] canvas');
      if (c && c.__drawnTexts && c.__drawnTexts.length){
        const mt = c.__drawnTexts.join(' ').match(/\b\d{1,6}\b/);
        if (mt) return Number(mt[0]);
      }
      const dataStock = card.getAttribute('data-stock') || card.querySelector('[data-stock]')?.getAttribute('data-stock');
      if (dataStock && /^\d+$/.test(dataStock)) return Number(dataStock);
      const stockEl = card.querySelector('.stock, .stock-count, [class*="stock"]');
      if (stockEl){
        const mt = (stockEl.textContent||'').replace(/\s+/g,' ').match(/\b\d{1,6}\b/);
        if (mt) return Number(mt[0]);
      }
      const pats = [/Stock[:\s]*([\d\.]+)/i,/Disponible[:\s]*([\d\.]+)/i,/Unidades[:\s]*([\d\.]+)/i,/\b(\d{1,6})\s*unidades\b/i,/\b(\d{1,6})\s*disponibles\b/i];
      const text = (card.innerText||'') + ' ' + canvasTexts(card);
      for (const p of pats){
        const m = text.match(p);
        if (m){ const n = Number(String(m[1]).replace(/\./g,'')); if (Number.isFinite(n)) return n; }
      }
      return null;
    };

    const out=[];
    const seen=new Set();
    const CARD_SEL='.product-card, app-card-product, [data-product-row], .card-box';

    for(const card of $$(CARD_SEL)){
      const name = clean((card.querySelector('h3, .title, .tittle-product, [class*="title"]')?.textContent)||'');
      if (!name) continue;

      const image = getImage(card);
      const uniqKey = name + '|' + (image||'');
      if (seen.has(uniqKey)) continue;
      seen.add(uniqKey);

      const category = getCategory(card);
      const provider  = getProviderFromCard(card);

      const raw = (card.innerText||'') + ' ' + canvasTexts(card);
      const moneyTokens = unique((raw.match(moneyRx) || []).map(s=>s.trim()));
      const priceProvider  = moneyTokens[0] || '';
      const priceSuggested = moneyTokens[1] || '';

      // NUEVO: estrategia robusta de href/productId
      let { href, productId } = robustHrefAndId(card);

      // Fallback por imagen si sigue sin datos
      if (!href || !productId){
        const byImg = hrefAndIdByImage(image, name);
        href = href || byImg.href;
        productId = productId || byImg.productId;
      }

      const stock = extractStock(card, raw);

      out.push({
        ...meta,
        name,
        category,
        provider,
        priceProvider,
        priceSuggested,
        stock,
        image,
        href,
        productId
      });
    }
    return out;
  }, { meta, baseOrigin, PRODUCT_ID_REGEXES: PRODUCT_ID_REGEXES.map(r=>r.source) });

  success(`🧾 Extraídos ${products.length} productos del grid.`);
  return products;
}

// ─────────────────────────────────────────────────────────────────────────────
// Scrape por proveedor + guardado (SIN CAMBIOS de estructura)
// ─────────────────────────────────────────────────────────────────────────────
async function scrapeProvider(context, url){
  const page = await context.newPage();

  await page.route('**/*', (route)=>{
    const rt = route.request().resourceType();
    if (rt === 'font' || rt === 'media') route.abort();
    else route.continue();
  });

  try{
    info(`➡️ Proveedor → ${url}`);
    await page.goto(url, { waitUntil:'domcontentloaded', timeout:90000 });

    await ordenarPorRecientes(page);
    await scrollConMostrarMas(page, 18);

    const meta = await page.evaluate(()=>{
      const h = document.querySelector('h1,h2');
      const providerName = (h?.textContent||'').trim() || 'Proveedor';
      const providerId   = Number((location.pathname.match(/provider\/(\d+)/)||[])[1]||0) || null;
      return { providerName, providerId, providerUrl: location.href };
    });

    const countryStr = detectCountryFromStrings(meta.providerUrl);
    const products = await extractProducts(page, meta);

    const dir = path.join(OUT_DIR, `prov_${meta.providerId||'x'}_${slug(meta.providerName)}_${nowIso()}`);
    fs.mkdirSync(dir, { recursive:true });

    fs.writeFileSync(
      path.join(dir, 'products.json'),
      JSON.stringify({ meta, country: countryStr, count: products.length, products }, null, 2),
      'utf8'
    );

    const cols = [
      'providerName','providerId','providerUrl','productId','name','category',
      'priceProvider','priceSuggested','stock','image','href','country'
    ];
    const esc=(v)=> v==null ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g,'""')}"` : String(v);

    const rows = [cols.join(',')].concat(
      products.map(p=>{
        const ctry = countryStr || detectCountryFromStrings(p.href, p.image, p.providerName) || '';
        const obj = { ...p, country: ctry };
        return cols.map(c=>esc(obj[c])).join(',');
      })
    );
    fs.writeFileSync(path.join(dir, 'products.csv'), rows.join('\n'), 'utf8');

    success(`💾 Guardado ${products.length} productos en: ${dir}`);

    return products.map(p=>{
      const ctry = countryStr || detectCountryFromStrings(p.href, p.image, p.providerName) || '';
      return { ...p, country: ctry };
    });
  }catch(e){
    error(`Scrape falló: ${e?.message||e}`);
    return [];
  }finally{
    await page.close().catch(()=>{});
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
(async ()=>{
  console.clear();
  console.log(chalk.magentaBright('\n👑 DropDrop Scraper — Multi-país + Master\n'));

  const cfgs = loadCountryConfigs();
  if (cfgs.length === 0) {
    error('No hay credenciales. Define EMAIL_XX, PASSWORD_XX y LOGIN_URL_XX en .env');
    process.exit(1);
  }

  const allProducts = [];
  const perCountry  = {};

  for (const cfg of cfgs) {
    const { cc, email, password, loginUrl, storage } = cfg;

    const ctxOpts = fs.existsSync(path.join(__dirname, storage))
      ? { storageState: path.join(__dirname, storage) }
      : {};

    const browser = await chromium.launch({ headless: HEADLESS });
    const context = await browser.newContext(ctxOpts);
    await addCanvasSniffer(context);
    await ensureLogin(context, { email, password, loginUrl, storage });

    const urls = loadProviderUrlsForCountry(cc);
    info(`🌎 [${cc}] Proveedores detectados: ${urls.length}`);
    perCountry[cc] = 0;

    for (const url of urls) {
      const ccFromUrl = ccFromDomain(url);
      if (ccFromUrl && ccFromUrl !== cc) {
        warn(`[${cc}] URL parece de ${ccFromUrl} (${url}) — sigo igual.`);
      }

      const rows = await scrapeProvider(context, url);
      allProducts.push(...rows);
      perCountry[cc] += rows.length;
    }

    await browser.close();

    if (CLEANUP_OUT) {
      const entries = fs.readdirSync(OUT_DIR).filter(f => f.startsWith('prov_'));
      for (const f of entries) {
        try { fs.rmSync(path.join(OUT_DIR, f), { recursive:true, force:true }); } catch {}
      }
      info(`🧹 Limpieza /out/prov_* completada.`);
    }
  }

  const ts = nowIso();
  const meta = { runAt: new Date().toISOString(), total: allProducts.length, byCountry: perCountry };

  fs.writeFileSync(
    path.join(MASTER_DIR, `master_${ts}.json`),
    JSON.stringify({ meta, products: allProducts }, null, 2),
    'utf8'
  );

  const cols = [
    'providerName','providerId','providerUrl','productId','name','category',
    'priceProvider','priceSuggested','stock','image','href','country'
  ];
  const esc=(v)=> v==null ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g,'""')}"` : String(v);
  const rows = [cols.join(',')].concat(
    allProducts.map(p => cols.map(c=>esc(p[c])).join(','))
  );
  fs.writeFileSync(path.join(MASTER_DIR, `master_${ts}.csv`), rows.join('\n'), 'utf8');

  success(`\n🎯 Master creado: /out/master/master_${ts}.{json,csv}`);
  success(`Totales por país: ${JSON.stringify(perCountry)}`);

  // ───────────────────────────────────────────────────────────────────────────
  // NUEVO: Disparo automático del ingestor si hay data y bandera activa
  // ───────────────────────────────────────────────────────────────────────────
  async function maybeIngest() {
    if (String(process.env.INGEST_AFTER_RUN || '0') !== '1') {
      info('INGEST_AFTER_RUN=0 → no se dispara ingest_supabase.js');
      return;
    }

    // Verifica que existan outputs /prov_* o master
    const hasProv = fs.existsSync(OUT_DIR) &&
      fs.readdirSync(OUT_DIR).some(n => n.startsWith('prov_'));
    const hasMaster = fs.existsSync(MASTER_DIR) &&
      fs.readdirSync(MASTER_DIR).some(n => /^master_.*\.(json|csv)$/i.test(n));

    if (!hasProv && !hasMaster) {
      warn('No hay datos en /out para ingestar. Saltando ingest.');
      return;
    }

    const ingestPath = path.join(__dirname, 'ingest_supabase.js');
    if (!fs.existsSync(ingestPath)) {
      warn(`No existe ${ingestPath}. Copia el ingestor al mismo directorio y reintenta.`);
      return;
    }

    info('🚚 Disparando ingest_supabase.js…');
    const child = spawn(process.execPath, [ingestPath], {
      stdio: 'inherit',
      env: process.env,
    });
    child.on('close', (code) => {
      if (code === 0) success('Ingest OK');
      else error(`Ingest salió con código ${code}`);
    });
  }

  await maybeIngest();
})();
j