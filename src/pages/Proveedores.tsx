import React from 'react';
// --- Se añaden más íconos que usaremos en la vista de detalle ---
import { Star, Package, BarChart2, ChevronRight, ShoppingBag, Gamepad2, Heart, Home, PawPrint, Wrench } from 'lucide-react';
import './Proveedores.css';
// --- Se importan tipos que necesitaremos para los datos ---
import { Product } from '../components/ProductCard';

// --- 1. SE EXPORTA UNA INTERFAZ DETALLADA PARA EL PROVEEDOR ---
// Esta interfaz será reutilizada en la página de detalle.
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
  totalSales: number; // Mantenemos este para la lista
  ordersShipped: number;
  ordersShippedChange: number;
  dropshippersActive: number;
  dropshippersActiveChange: number;
  fillRate: string;
  returnsRate: string;
  categories: { icon: JSX.Element; name: string }[];
  newProducts: Product[];
}

// --- Datos de ejemplo para los "Nuevos Productos" de un proveedor ---
const mockNewProducts: Product[] = [
  { productId: 201, name: "Set de Manicure y Pedicure PRO", providerName: "TecnoChile SpA", stock: 120, image: "https://placehold.co/400x300/a3e635/ffffff/png?text=Manicure+Set", priceProvider: "CLP $29.990", sales: 75, totalStock: 200, salesLast7Days: [], providerUrl: "#", href: "#" },
  { productId: 202, name: "Auriculares Inalámbricos Xtreme Sound", providerName: "TecnoChile SpA", stock: 90, image: "https://placehold.co/400x300/fcd34d/ffffff/png?text=Auriculares", priceProvider: "CLP $39.990", sales: 110, totalStock: 150, salesLast7Days: [], providerUrl: "#", href: "#" },
];

// --- 2. SE ACTUALIZAN LOS DATOS DE EJEMPLO CON LA NUEVA ESTRUCTURA ---
const mockProveedores: ProveedorInfo[] = [
  {
    id: 1, name: 'TecnoChile SpA', logoUrl: 'https://placehold.co/100x100/007bff/ffffff/png?text=TC', rating: 4.8, onlineSince: '27/10/2023', lastConnection: 'hoy', isVerified: true, isPremium: true, productCount: 124, totalSales: 8750, ordersShipped: 2339, ordersShippedChange: 12, dropshippersActive: 59, dropshippersActiveChange: -3, fillRate: 'SLA 24-48h', returnsRate: '1.2%', categories: [{ icon: <Gamepad2 />, name: 'Gaming' }], newProducts: mockNewProducts
  },
  {
    id: 2, name: 'Hot Drops CL', logoUrl: 'https://placehold.co/100x100/1a2c50/ffffff/png?text=HD', rating: 4.5, onlineSince: '15/05/2023', lastConnection: 'ayer', isVerified: true, isPremium: false, productCount: 88, totalSales: 11200, ordersShipped: 11200, ordersShippedChange: 5, dropshippersActive: 35, dropshippersActiveChange: 8, fillRate: 'SLA 48-72h', returnsRate: '2.1%', categories: [{ icon: <Heart />, name: 'Belleza' }], newProducts: []
  },
  {
    id: 3, name: 'Casa Futura', logoUrl: 'https://placehold.co/100x100/66a6ff/ffffff/png?text=CF', rating: 4.9, onlineSince: '01/01/2023', lastConnection: 'hace 2 días', isVerified: true, isPremium: true, productCount: 215, totalSales: 15300, ordersShipped: 15300, ordersShippedChange: 1, dropshippersActive: 80, dropshippersActiveChange: 0, fillRate: 'SLA 24h', returnsRate: '0.8%', categories: [{ icon: <Home />, name: 'Hogar' }], newProducts: []
  },
  {
    id: 4, name: 'Importadora Rápida', logoUrl: 'https://placehold.co/100x100/ff8c00/ffffff/png?text=IR', rating: 4.6, onlineSince: '10/03/2023', lastConnection: 'hace 5 horas', isVerified: false, isPremium: false, productCount: 180, totalSales: 13500, ordersShipped: 13500, ordersShippedChange: -2, dropshippersActive: 40, dropshippersActiveChange: -5, fillRate: 'SLA 72h', returnsRate: '3.0%', categories: [{ icon: <Wrench />, name: 'Herramientas' }], newProducts: []
  },
];

// --- 3. EL COMPONENTE AHORA RECIBE UNA FUNCIÓN 'onProveedorSelect' ---
interface ProveedoresProps {
  onProveedorSelect: (proveedor: ProveedorInfo) => void;
}

const Proveedores: React.FC<ProveedoresProps> = ({ onProveedorSelect }) => {
  return (
    <div className="proveedores-page">
      <h2 className="proveedores-title">Nuestros Proveedores</h2>
      <p className="proveedores-subtitle">Conoce a los socios estratégicos detrás de nuestros productos.</p>
      
      <div className="proveedores-list">
        {mockProveedores.map((proveedor) => (
          // --- 4. SE AÑADE EL EVENTO onClick A CADA FILA ---
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
                <span className="stat-label">Ventas</span>
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