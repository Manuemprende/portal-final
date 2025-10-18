// src/pages/NichoDetalle.tsx
import React, { useEffect, useRef, useState } from 'react';
import ProductCard, { Product } from '../components/ProductCard';
import { fetchHotProducts } from '../services/hot';
import './NichoDetalle.css';

type Props = {
  nicho: { id: number; name: string };
  onBack: () => void;
  darkMode: boolean;
  countryCode?: string; // para filtrar por país cuando la vista lo tenga
};

const PAGE = 30;

const NichoDetalle: React.FC<Props> = ({ nicho, onBack, darkMode, countryCode }) => {
  const [items, setItems] = useState<Product[]>([]);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const watcher = useRef<HTMLDivElement | null>(null);

  // reset al cambiar categoría/país
  useEffect(() => {
    setItems([]);
    setOffset(0);
    setHasMore(true);
  }, [nicho.name, countryCode]);

  // carga
  useEffect(() => {
    if (!hasMore || loading) return;
    (async () => {
      setLoading(true);
      const page = await fetchHotProducts({
        offset,
        limit: PAGE,
        category: nicho.name,
        countryCode,
      });
      setItems((prev) => prev.concat(page));
      setHasMore(page.length === PAGE);
      setOffset((prev) => prev + page.length);
      setLoading(false);
    })();
  }, [offset, nicho.name, countryCode]); // eslint-disable-line

  // infinite scroll
  useEffect(() => {
    if (!watcher.current) return;
    const io = new IntersectionObserver(
      (entries) => {
        const [e] = entries;
        if (e.isIntersecting && !loading && hasMore) {
          setOffset((o) => o);
          setTimeout(() => setOffset((o) => o), 0);
        }
      },
      { rootMargin: '600px' }
    );
    io.observe(watcher.current);
    return () => io.disconnect();
  }, [loading, hasMore]);

  return (
    <div className="nicho-detalle">
      <button className="back-btn" onClick={onBack}>← Volver a Nichos</button>
      <h2 className="nicho-title">{nicho.name}</h2>

      <section className="products-grid">
        {items.map((p) => (
          <ProductCard key={`${p.productId}-${p.href || ''}`} product={p} darkMode={darkMode} />
        ))}
      </section>

      <div ref={watcher} />
      {loading && <div className="loading-more">Cargando…</div>}
      {!loading && items.length === 0 && <div className="empty">Sin productos en esta categoría.</div>}
      {!hasMore && items.length > 0 && <div className="no-more">No hay más productos</div>}
    </div>
  );
};

export default NichoDetalle;
