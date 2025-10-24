// src/pages/Nichos.tsx
import React, { useEffect, useState } from 'react';
import { ShoppingBag, Heart, Home, PawPrint, Gamepad2, Wrench, Package, BarChart2 } from 'lucide-react';
import './Nichos.css';
import { fetchHotProducts, HotProduct } from '../services/hot';
import { useCountryStore } from '../state/useCountry'; // Import country store

export interface Nicho {
  id: number;
  name: string;
  description: string;
  icon: JSX.Element;
  productCount: number;
  providerCount: number; // Changed from totalSales to providerCount
}

interface NichosProps {
  onNicheSelect: (nicho: Nicho) => void;
}

// (iconFor and descriptionFor functions remain the same)
const iconFor = (category: string) => {
  const c = category.toLowerCase();
  if (c.includes('moda')) return <ShoppingBag size={40} className="nicho-icon" />;
  if (c.includes('belleza')) return <Heart size={40} className="nicho-icon" />;
  if (c.includes('hogar')) return <Home size={40} className="nicho-icon" />;
  if (c.includes('mascota')) return <PawPrint size={40} className="nicho-icon" />;
  if (c.includes('tecno') || c.includes('gamer')) return <Gamepad2 size={40} className="nicho-icon" />;
  if (c.includes('herram')) return <Wrench size={40} className="nicho-icon" />;
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
  const [nichos, setNichos] = useState<Nicho[]>([]);
  const [loading, setLoading] = useState(true);
  const { country } = useCountryStore(); // Get selected country

  useEffect(() => {
    setLoading(true);
    (async () => {
      const products = await fetchHotProducts({ country, limit: 1000 }); // Fetch by country
      
      // Group products by category to create summaries
      const summary: { [key: string]: { products: Set<number>, providers: Set<number> } } = {};

      products.forEach(p => {
        const cat = p.category_name;
        if (!cat) return; // Skip products without category
        if (!summary[cat]) {
          summary[cat] = { products: new Set(), providers: new Set() };
        }
        if(p.prod_id) summary[cat].products.add(p.prod_id);
        if(p.provider_id) summary[cat].providers.add(p.provider_id);
      });

      const calculatedNichos: Nicho[] = Object.keys(summary).map((name, idx) => ({
        id: idx + 1,
        name,
        description: descriptionFor(name),
        icon: iconFor(name),
        productCount: summary[name].products.size,
        providerCount: summary[name].providers.size,
      }));

      setNichos(calculatedNichos);
      setLoading(false);
    })();
  }, [country]); // Re-run when country changes

  return (
    <div className="nichos-page">
      <h2 className="nichos-title">Explora por Nichos</h2>
      <p className="nichos-subtitle">Encuentra los productos perfectos para cada mercado.</p>

      {loading && <div className="nichos-loading">Cargando categorías…</div>}

      {!loading && (
        <div className="nichos-grid">
          {nichos.map((nicho) => (
            <div key={nicho.id} className="nicho-card" onClick={() => onNicheSelect(nicho)}>
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
                  <span className="stat-value">{nicho.providerCount}</span>
                  <span className="stat-label">Proveedores</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Nichos;
