// api_server.js
import express from 'express';
import fs from 'fs';
import path from 'path';
import cors from 'cors';

const PORT = process.env.PORT || 3000;
const MASTER_FILE = path.join(process.cwd(), 'out', 'master', 'master.json');

if (!fs.existsSync(MASTER_FILE)) {
  console.error('No existe out/master/master.json. Corre primero: node aggregator_build_master.js');
  process.exit(1);
}

const master = JSON.parse(fs.readFileSync(MASTER_FILE, 'utf8'));
const app = express();
app.use(cors());

// helpers
const num = (v, d)=> (isNaN(Number(v)) ? d : Number(v));
const norm = (s)=> String(s||'').toLowerCase();

app.get('/api/health', (_,res)=> res.json({ok:true, generatedAt: master.generatedAt}));

app.get('/api/drophot', (req,res)=>{
  const { country, limit='100' } = req.query;
  let list = master.drophot || [];
  if (country) list = list.filter(p => p.country === country);
  res.json(list.slice(0, num(limit, 100)));
});

app.get('/api/providers', (req,res)=>{
  const { country } = req.query;
  let list = master.providers || [];
  if (country) list = list.filter(p => p.country === country);
  res.json(list);
});

app.get('/api/categories', (req,res)=>{
  const { country } = req.query;
  if (!country) return res.json(master.categories);
  res.json({ [country]: master.categories[country] || [] });
});

app.get('/api/products', (req,res)=>{
  const { country, providerId, category, q, page='1', limit='50' } = req.query;
  let list = master.products || [];
  if (country)    list = list.filter(p => p.country === country);
  if (providerId) list = list.filter(p => String(p.providerId) === String(providerId));
  if (category)   list = list.filter(p => norm(p.category) === norm(category));
  if (q) {
    const s = norm(q);
    list = list.filter(p => norm(p.name).includes(s));
  }
  const p = Math.max(1, num(page,1)), l = Math.min(200, num(limit,50));
  const off = (p-1)*l;
  res.json({
    total: list.length, page: p, limit: l,
    items: list.slice(off, off + l)
  });
});

app.listen(PORT, ()=> console.log(`API lista en http://localhost:${PORT}`));
