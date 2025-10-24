import React, { useEffect, useState } from 'react';
import { Star, Package, BarChart2, ChevronRight, Gamepad2, Heart, Home, PawPrint, Wrench, ShoppingBag } from 'lucide-react';
import './Proveedores.css';
import { fetchHotProducts, HotProduct } from '../services/hot';
import { useCountryStore } from '../state/useCountry';
import type { Product } from '../components/ProductCard';

// The detailed provider interface, shared with the detail page.
export interface ProveedorInfo {
  id: number;
  name: string;
  logoUrl: string;
  rating: number;
  onlineSince: string;
  lastConnection: string;
  isVerified: boolean;
  isPremium: boolean;
  productCount: number;
  totalSales: number; // For display, we'll use 7-day sales
  ordersShipped: number;
  ordersShippedChange: number;
  dropshippersActive: number;
  dropshippersActiveChange: number;
  fillRate: string;
  returnsRate: string;
  categories: { icon: JSX.Element; name: string }[];
  newProducts: Product[];
}

// Generates a consistent placeholder logo
const generateLogoUrl = (name: string) => {
  const colors = ['007bff', '1a2c50', '66a6ff', 'ff8c00', '28a745', 'dc3545'];
  const hash = name.split('').reduce((acc, char) => char.charCodeAt(0) + ((acc << 5) - acc), 0);
  const color = colors[Math.abs(hash) % colors.length];
  const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  return `https://placehold.co/100x100/${color}/ffffff/png?text=${initials}`;
};

interface ProveedoresProps {
  onProveedorSelect: (proveedor: ProveedorInfo) => void;
}

const Proveedores: React.FC<ProveedoresProps> = ({ onProveedorSelect }) => {
  const [proveedores, setProveedores] = useState<ProveedorInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const { country } = useCountryStore();

  useEffect(() => {
    setLoading(true);
    (async () => {
      const products = await fetchHotProducts({ country, limit: 1000 });

      const summary: { [key: number]: { name: string; products: Set<number>; sales: number; cats: Set<string> } } = {};

      products.forEach(p => {
        if (!p.provider_id || !p.provider_name) return;
        if (!summary[p.provider_id]) {
          summary[p.provider_id] = { name: p.provider_name, products: new Set(), sales: 0, cats: new Set() };
        }
        if (p.prod_id) summary[p.provider_id].products.add(p.prod_id);
        if (p.category_name) summary[p.provider_id].cats.add(p.category_name);
        summary[p.provider_id].sales += p.sales_7d || 0;
      });
      
      const calculatedProveedores: ProveedorInfo[] = Object.entries(summary).map(([id, data]) => ({
        id: Number(id),
        name: data.name,
        logoUrl: generateLogoUrl(data.name),
        rating: 4.5 + (Number(id) % 5) / 10,
        productCount: data.products.size,
        totalSales: data.sales, // Using 7d sales
        ordersShipped: data.sales, // Proxy
        // Placeholder for other fields
        onlineSince: '2023', lastConnection: 'N/A', isVerified: true, isPremium: data.sales > 100, ordersShippedChange: 0, dropshippersActive: 0, dropshippersActiveChange: 0, fillRate: 'N/A', returnsRate: 'N/A', newProducts: [],
        categories: Array.from(data.cats).map(c => ({ name: c, icon: <Package/> }))
      }));
      
      calculatedProveedores.sort((a,b) => b.totalSales - a.totalSales);

      setProveedores(calculatedProveedores);
      setLoading(false);
    })();
  }, [country]);

  if (loading) {
    return (
        <div className="proveedores-page">
            <h2 className="proveedores-title">Nuestros Proveedores</h2>
            <p className="proveedores-subtitle">Conoce a los socios estratégicos detrás de nuestros productos.</p>
            <div className="loading-more">Cargando proveedores...</div>
        </div>
    );
  }

  return (
    <div className="proveedores-page">
      <h2 className="proveedores-title">Nuestros Proveedores</h2>
      <p className="proveedores-subtitle">Conoce a los socios estratégicos detrás de nuestros productos.</p>
      <div className="proveedores-list">
        {proveedores.map((proveedor) => (
          <div key={proveedor.id} className="proveedor-row" onClick={() => onProveedorSelect(proveedor)}>
            <div className="proveedor-info">
              <img src={proveedor.logoUrl} alt={`Logo de ${proveedor.name}`} className="proveedor-logo" />
              <div className="proveedor-name-rating">
                <h3 className="proveedor-name">{proveedor.name}</h3>
                <div className="proveedor-rating">
                  <Star size={16} className="star-icon" />
                  <span>{proveedor.rating.toFixed(1)}</span>
                </div>
              </div>
            </div>
            <div className="proveedor-stats">
              <div className="stat-item">
                <Package size={20} />
                <span className="stat-value">{proveedor.productCount}</span>
                <span className="stat-label">Productos</span>
              </div>
              <div className="stat-item">
                <BarChart2 size={20} />
                <span className="stat-value">{proveedor.totalSales.toLocaleString('es-CL')}</span>
                <span className="stat-label">Ventas (7d)</span>
              </div>
            </div>
            <div className="proveedor-cta">
              <button className="cta-button">
                <span>Ver Perfil</span>
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Proveedores;
