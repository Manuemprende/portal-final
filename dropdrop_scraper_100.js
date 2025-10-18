// dropdrop_scraper_fast_merge_v18_1_country.js
// 🚀 Ultra-rápido (≤1 min/proveedor, sin visitar fichas) + país en CSV
// - Ordena por "Más recientes"
// - Scroll con "Mostrar más productos"
// - Extrae: priceProvider / priceSuggested / category / stock / image / href / productId
// - 🔹 Añade columna "country" (por URL/domino y rutas /{pais}/)
// - Guarda JSON y CSV por proveedor

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import chalk from 'chalk';
import cliProgress from 'cli-progress';

const HEADLESS = String(process.env.HEADLESS ?? 'true').toLowerCase() === 'true';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EMAIL       = process.env.EMAIL || '';
const PASSWORD    = process.env.PASSWORD || '';
const LOGIN_URL   = 'https://app.dropi.cl/auth/login';
const STORAGE_FILE= path.join(__dirname, 'auth.json');
const OUT_DIR     = path.join(__dirname, 'out');
fs.mkdirSync(OUT_DIR, { recursive: true });

const sleep  = (ms)=>new Promise(r=>setTimeout(r,ms));
const nowIso = ()=> new Date().toISOString().replace(/[:.]/g,'-');
const slug   = (s)=>(s||'').toLowerCase().normalize('NFD')
  .replace(/\p{Diacritic}/gu,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');

const info    = (m)=>console.log(chalk.cyan(`ℹ️ ${m}`));
const success = (m)=>console.log(chalk.green(`✅ ${m}`));
const warn    = (m)=>console.log(chalk.yellow(`⚠️ ${m}`));
const error   = (m)=>console.log(chalk.red(`❌ ${m}`));

// ---------- País ----------
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

// ---------- Loader de URLs ----------
async function loadProviderUrls() {
  const baseDir = path.resolve(process.cwd());
  const providersDir = path.join(baseDir, 'providers');
  const urls = new Set();

  if (fs.existsSync(providersDir)) {
    const files = fs.readdirSync(providersDir).filter(f => f.toLowerCase().endsWith('.txt'));
    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(providersDir, file), 'utf8');
        content.split(/\r?\n/).map(l=>l.trim()).filter(Boolean).forEach(u=>urls.add(u));
      } catch {}
    }
  }

  if (urls.size === 0) {
    const fallback = path.join(baseDir, 'providers_urls.txt');
    if (fs.existsSync(fallback)) {
      const content = fs.readFileSync(fallback, 'utf8');
      content.split(/\r?\n/).map(l=>l.trim()).filter(Boolean).forEach(u=>urls.add(u));
    }
  }

  return Array.from(urls);
}

// ---------- Canvas Sniffer ----------
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

// ---------- Login ----------
async function ensureLogin(context){
  const page = await context.newPage();
  info('🔐 Verificando sesión...');
  await page.goto(LOGIN_URL, { waitUntil:'domcontentloaded', timeout:60000 });
  if (await page.$('aside,nav,[class*="sidebar"],header,[data-role="sidebar"]')){
    success('Sesión existente detectada.');
    await context.storageState({path:STORAGE_FILE}).catch(()=>{});
    await page.close(); return;
  }
  await page.fill('input[name="email"], input#email, input[type="email"]', EMAIL);
  await page.fill('input[name="password"], input#password, input[type="password"]', PASSWORD);
  await Promise.any([
    page.click('form button[type="submit"], button:has-text("Iniciar"), button:has-text("Ingresar"), button:has-text("Login")').catch(()=>{}),
    page.press('input[type="password"]','Enter').catch(()=>{})
  ]);
  await page.waitForSelector('aside,nav,[class*="sidebar"],header,[data-role="sidebar"]', { timeout:70000 }).catch(()=>null);
  await context.storageState({path:STORAGE_FILE}).catch(()=>{});
  await page.close();
  success('✅ Sesión iniciada y guardada (auth.json)');
}

// ---------- Orden ----------
async function ordenarPorRecientes(page){
  try{
    await page.evaluate(()=>{ document.body.style.zoom='0.4'; });
    await page.waitForSelector('.order-list .dropdown-toggle', {timeout:12000});
    await page.click('.order-list .dropdown-toggle', { delay:150 });
    await sleep(400);
    await page.locator('.dropdown-menu span', { hasText: 'Más recientes' }).click({ delay:150 });
    await page.waitForLoadState('networkidle', { timeout:4000 }).catch(()=>{});
    success('🔽 Orden configurado: "Más recientes"');
  }catch{
    warn('No se encontró el menú de orden. Continuando…');
  }
}

// ---------- Scroll + Mostrar más ----------
async function scrollConMostrarMas(page, maxNoGrowth=18){
  info('📜 Scroll infinito + "Mostrar más productos"…');
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
  success(`📜 Scroll finalizado. Tarjetas vistas: ${total}, clics "Mostrar más": ${clicks}`);
  return total;
}

// ---------- Extracción ----------
async function extractProducts(page, meta){
  info('🧠 Extrayendo productos del DOM…');

  const products = await page.evaluate(({ meta })=>{
    const $$=(q,r=document)=>Array.from(r.querySelectorAll(q));
    const t =(el)=> (el?.textContent||'').replace(/\s+/g,' ').trim();
    const clean=(s)=> (s||'').replace(/\s+/g, ' ').trim();

    const moneyRx = /(?:\$|\bCLP\b)\s*\d[\d\.\,]*/gi;
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
      return imgs.find(s=>!/verified|categories_providers|logo|no-image/i.test(s)) || imgs[0] || '';
    };

    const hrefAndIdByLinks=(card)=>{
      const link = card.querySelector('a[href*="/product-details/"], a[href*="/dashboard/product"], a[href*="/product"]');
      if (link){
        const href = link.href || link.getAttribute('href');
        const m = String(href||'').match(/product-details\/(\d+)|product\/(\d+)/i);
        return { href: href && href.startsWith('http') ? href : (href?`https://app.dropi.cl${href.startsWith('/')?'':'/'}${href}`: null),
                 productId: m ? Number(m[1]||m[2]) : null };
      }
      const rlEl = card.querySelector('[routerlink], [ng-reflect-router-link]');
      if (rlEl){
        const rl = rlEl.getAttribute('routerlink') || rlEl.getAttribute('ng-reflect-router-link') || '';
        const href = rl.startsWith('http') ? rl : `https://app.dropi.cl${rl.startsWith('/')?'':'/'}${rl}`;
        const m = href.match(/product-details\/(\d+)|product\/(\d+)/i);
        return { href, productId: m? Number(m[1]||m[2]) : null };
      }
      const onclick = card.getAttribute('onclick') || (card.querySelector('[onclick]')?.getAttribute('onclick')) || '';
      const mo = onclick.match(/product-details\/(\d+)|product\/(\d+)/i);
      if (mo){
        const id = Number(mo[1]||mo[2]);
        return { href: `https://app.dropi.cl/dashboard/product-details/${id}`, productId: id };
      }
      return { href:null, productId:null };
    };

    const hrefAndIdByImage=(imgSrc, name)=>{
      if (!imgSrc) return { href:null, productId:null };
      const m = imgSrc.match(/\/products\/(\d+)\//i);
      if (m){
        const id = Number(m[1]);
        const slug = (name||'').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
        return { href:`https://app.dropi.cl/dashboard/product-details/${id}/${slug}`, productId:id };
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

      let { href, productId } = hrefAndIdByLinks(card);
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
  }, { meta });

  success(`🧾 Extraídos ${products.length} productos del grid.`);
  return products;
}

// ---------- Scrape por proveedor ----------
async function scrapeProvider(context, url){
  const page = await context.newPage();

  // Bloquear recursos pesados
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
      const providerId = Number((location.pathname.match(/provider\/(\d+)/)||[])[1]||0) || null;
      return { providerName, providerId, providerUrl: location.href };
    });

    // ▼ país (por providerUrl)
    const country = detectCountryFromStrings(meta.providerUrl);

    const products = await extractProducts(page, meta);

    const dir = path.join(OUT_DIR, `prov_${meta.providerId||'x'}_${slug(meta.providerName)}_${nowIso()}`);
    fs.mkdirSync(dir, { recursive:true });

    // JSON
    fs.writeFileSync(path.join(dir, 'products.json'), JSON.stringify({ meta, country, count:products.length, products }, null, 2), 'utf8');

    // CSV (incluye country)
    const cols = [
      'providerName','providerId','providerUrl','productId','name','category',
      'priceProvider','priceSuggested','stock','image','href','country'
    ];
    const esc=(v)=> v==null ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g,'""')}"` : String(v);

    const rows = [cols.join(',')].concat(
      products.map(p=>{
        const ctry = country || detectCountryFromStrings(p.href, p.image, p.providerName) || '';
        const obj = { ...p, country: ctry };
        return cols.map(c=>esc(obj[c])).join(',');
      })
    );
    fs.writeFileSync(path.join(dir, 'products.csv'), rows.join('\n'), 'utf8');

    success(`💾 Guardado ${products.length} productos en: ${dir}`);
  }catch(e){
    error(`Scrape falló: ${e?.message||e}`);
  }finally{
    await page.close().catch(()=>{});
  }
}

// ---------- MAIN ----------
(async ()=>{
  console.clear();
  console.log(chalk.magentaBright('\n👑 DropDrop Scraper — v18.1 (country en CSV, sin fichas)'));

  if (!EMAIL || !PASSWORD){
    console.log(chalk.red('Faltan EMAIL/PASSWORD en .env'));
    process.exit(1);
  }

  const ctxOpts = fs.existsSync(STORAGE_FILE) ? { storageState: STORAGE_FILE } : {};
  const browser = await chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext(ctxOpts);
  await addCanvasSniffer(context);
  await ensureLogin(context);

  const providers = await loadProviderUrls();
  if (providers.length===0){
    console.log(chalk.red('No se encontraron URLs en /providers/*.txt ni en providers_urls.txt'));
    await browser.close(); process.exit(1);
  }
  info(`Detectados ${providers.length} proveedores.`);

  for (const url of providers){
    await scrapeProvider(context, url);
  }

  await browser.close();
  success('🎯 Finalizado.');
})();
