// Ejemplo: consolidator.js
import fs from 'fs/promises';
import path from 'path';

const OUT_DIR = path.join(__dirname, 'out');

async function processData() {
    let allProducts = [];
    const providerDirs = await fs.readdir(OUT_DIR);

    for (const dirName of providerDirs) {
        if (!dirName.startsWith('prov_')) continue;

        const providerPath = path.join(OUT_DIR, dirName);
        const files = await fs.readdir(providerPath);
        const latestJsonFile = files.filter(f => f.endsWith('.json')).pop(); // Asume el último es el más nuevo

        if (latestJsonFile) {
            const filePath = path.join(providerPath, latestJsonFile);
            const fileContent = await fs.readFile(filePath, 'utf8');
            const data = JSON.parse(fileContent);
            allProducts.push(...data.products);
        }
    }

    console.log(`Encontrados ${allProducts.length} productos en total.`);

    // Limpieza y estandarización
    const cleanedProducts = allProducts.map(product => {
        // Limpiar precios
        const priceProvider = product.priceProvider ? parseFloat(product.priceProvider.replace(/\$|\./g, '').trim()) : 0;
        const priceSuggested = product.priceSuggested ? parseFloat(product.priceSuggested.replace(/\$|\./g, '').trim()) : 0;

        return {
            ...product,
            priceProvider,
            priceSuggested,
            stock: product.stock === null ? 0 : product.stock,
            country: 'CL', // ¡Importante para el futuro!
            lastUpdated: new Date().toISOString(),
        };
    });

    console.log('Productos limpios y estandarizados.');
    
    // El siguiente paso sería guardar `cleanedProducts` en la base de datos.
    // await saveToDatabase(cleanedProducts);
}

processData();