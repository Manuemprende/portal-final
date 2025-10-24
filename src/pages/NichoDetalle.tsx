// src/pages/NichoDetalle.tsx
import React, { useEffect, useState } from 'react';
import ProductCard from '../components/ProductCard';
import { fetchHotProducts, HotProduct } from '../services/hot'; // Import HotProduct type
import './NichoDetalle.css';

type Props = {
  nicho: { id: number; name: string };
  onBack: () => void;
  darkMode: boolean;
  countryCode?: string;
};

const NichoDetalle: React.FC<Props> = ({ nicho, onBack, darkMode, countryCode }) => {
  const [items, setItems] = useState<HotProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    (async () => {
      // Fetch all products, then filter by category client-side
      const allProducts = await fetchHotProducts({ country: countryCode, limit: 200 });
      const filteredProducts = allProducts.filter(p => p.category_name === nicho.name);
      
      setItems(filteredProducts);
      setLoading(false);
    })();
  }, [nicho.name, countryCode]);

  // The ProductCard expects a `Product` type, which might be different.
  // We need to map HotProduct to what ProductCard expects.
  // Let's create a compatible object on the fly.
  const toCardProduct = (p: HotProduct) => ({
    productId: p.prod_id || p.product_id || p.id || -1,
    name: p.name,
    imageUrl: p.image_url || p.picture || '',
    price: p.price,
    sales7d: p.sales_7d,
    rank: p.hot_rank || p.rank,
    href: '#', // HotProduct doesn't have a direct href
  });

  return (
    <div className="nicho-detalle">
      <button className="back-btn" onClick={onBack}>← Volver a Nichos</button>
      <h2 className="nicho-title">{nicho.name}</h2>

      {loading ? (
        <div className="loading-more">Cargando…</div>
      ) : items.length > 0 ? (
        <section className="products-grid">
          {items.map((p) => (
            <ProductCard key={`${p.prod_id}-${p.provider_id}`} product={toCardProduct(p)} darkMode={darkMode} />
          ))}
        </section>
      ) : (
        <div className="empty">Sin productos en esta categoría.</div>
      )}
    </div>
  );
};

export default NichoDetalle;
