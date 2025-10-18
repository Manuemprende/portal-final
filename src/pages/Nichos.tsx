// src/pages/Nichos.tsx
import React, { useEffect, useState } from 'react';
import { ShoppingBag, Heart, Home, PawPrint, Gamepad2, Wrench, Package, BarChart2 } from 'lucide-react';
import './Nichos.css';
import { fetchCategoriesSummary, type CategorySummaryRow } from '../services/hot';

// Estructura del nicho que usamos en la app
export interface Nicho {
  id: number;           // interno (índice)
  name: string;         // nombre visible (category)
  description: string;  // texto corto
  icon: JSX.Element;    // ícono
  productCount: number; // products
  totalSales: number;   // si más adelante lo obtienes; por ahora 0
}

interface NichosProps {
  onNicheSelect: (nicho: Nicho) => void;
}

const iconFor = (category: string) => {
  const c = category.toLowerCase();
  if (c.includes('moda')) return <ShoppingBag size={40} className="nicho-icon" />;
  if (c.includes('belleza')) return <Heart size={40} className="nicho-icon" />;
  if (c.includes('hogar')) return <Home size={40} className="nicho-icon" />;
  if (c.includes('mascota')) return <PawPrint size={40} className="nicho-icon" />;
  if (c.includes('tecno') || c.includes('gamer')) return <Gamepad2 size={40} className="nicho-icon" />;
  if (c.includes('herram')) return <Wrench size={40} className="nicho-icon" />;
  // default:
  return <Package size={40} className="nicho-icon" />;
};

const descriptionFor = (category: string) => {
  const c = category.toLowerCase();
  if (c.includes('moda')) return 'Ropa, calzado y complementos en tendencia.';
  if (c.includes('belleza')) return 'Cuidado personal, piel, maquillaje y más.';
  if (c.includes('hogar')) return 'Artículos para embellecer y organizar cada espacio.';
  if (c.includes('mascota')) return 'Todo lo que tus compañeros peludos necesitan.';
  if (c.includes('tecno')) return 'Gadgets y accesorios tecnológicos.';
  if (c.includes('herram')) return 'Soluciones para reparaciones y proyectos.';
  return 'Productos destacados de este nicho.';
};

const Nichos: React.FC<NichosProps> = ({ onNicheSelect }) => {
  const [cats, setCats] = useState<CategorySummaryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const data = await fetchCategoriesSummary();
      setCats(data);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="nichos-page">
      <h2 className="nichos-title">Explora por Nichos</h2>
      <p className="nichos-subtitle">Encuentra los productos perfectos para cada mercado.</p>

      {loading && <div className="nichos-loading">Cargando categorías…</div>}

      {!loading && (
        <div className="nichos-grid">
          {cats.map((row, idx) => {
            const nicho: Nicho = {
              id: idx + 1,
              name: row.category,
              description: descriptionFor(row.category),
              icon: iconFor(row.category),
              productCount: row.products,
              totalSales: 0, // si luego tenemos ventas por categoría, lo mapeamos aquí
            };
            return (
              <div key={`${row.category}-${idx}`} className="nicho-card" onClick={() => onNicheSelect(nicho)}>
                {nicho.icon}
                <h3 className="nicho-name">{nicho.name}</h3>
                <p className="nicho-description">{nicho.description}</p>

                <div className="nicho-stats">
                  <div className="stat-item">
                    <Package size={20} />
                    <span className="stat-value">{nicho.productCount}</span>
                    <span className="stat-label">Productos</span>
                  </div>
                  <div className="stat-item">
                    <BarChart2 size={20} />
                    <span className="stat-value">{(row.providers ?? 0).toLocaleString('es-CL')}</span>
                    <span className="stat-label">Proveedores</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Nichos;
