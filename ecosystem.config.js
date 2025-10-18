// ecosystem.config.js
module.exports = {
  apps: [
    // API
    {
      name: 'dropi-api',
      script: 'api_server.js',
      env: { NODE_ENV: 'production' }
    },

    // Agregador (corre una vez al día)
    {
      name: 'dropi-aggregator',
      script: 'aggregator_build_master.js',
      cron_restart: '0 3 * * *',   // 03:00 AM diario
      autorestart: false
    },

    // Scrapers por país (ajusta proveedores_*.txt en tu .env o por arg)
    {
      name: 'scraper-CL',
      script: 'dropdrop_scraper_fast_merge_v18_1.js',
      env: { HEADLESS: 'true' },
      args: '', // usa providers/providers_CL.txt internamente
      cron_restart: '0 1 * * *' // 01:00 AM diario
    },
    {
      name: 'scraper-AR',
      script: 'dropdrop_scraper_fast_merge_v18_1.js',
      env: { HEADLESS: 'true' },
      args: '',
      cron_restart: '30 1 * * *'
    },
    // ... replica 10 países con distintos minutos
  ]
};
