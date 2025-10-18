import React, { useState, useMemo } from 'react';
import { ArrowLeft, Package, BarChart2 } from 'lucide-react';
import ProductCard, { Product } from '../components/ProductCard';
import './ProveedorDetalle.css';
import { ProveedorInfo } from './Proveedores'; 

interface ProveedorDetalleProps {
  proveedor: ProveedorInfo;
  onBack: () => void;
  darkMode: boolean;
}

const ProveedorDetalle: React.FC<ProveedorDetalleProps> = ({ proveedor, onBack, darkMode }) => {
  // CORRECCIÓN: Aseguramos que allProducts sea siempre un array para evitar errores
  const allProducts = proveedor.allProducts || [];
  const [selectedCategory, setSelectedCategory] = useState('Todas');

  const topProducts = useMemo(() => {
    return [...allProducts]
      .sort((a, b) => (b.sales || 0) - (a.sales || 0))
      .slice(0, 4);
  }, [allProducts]);

  const categories = useMemo(() => {
    const productCategories = allProducts.map(p => p.category).filter(Boolean) as string[];
    return ['Todas', ...new Set(productCategories)];
  }, [allProducts]);

  const filteredProducts = useMemo(() => {
    let products = allProducts;
    if (selectedCategory !== 'Todas') {
      products = products.filter(p => p.category === selectedCategory);
    }
    // Se ordena siempre por ventas
    return products.sort((a, b) => (b.sales || 0) - (a.sales || 0));
  }, [allProducts, selectedCategory]);

  return (
    <div className="proveedor-detalle-page">
      <div className="proveedor-info-banner">
        <div className="info-top">
          <img src={proveedor.logoUrl} alt={proveedor.name} className="banner-logo" />
          <div className="provider-details">
            <div className="provider-title-line">
              <h2 className="provider-name">{proveedor.name}</h2>
              <div className="provider-main-stats">
                <div className="main-stat-item"><Package size={18} /><strong>{proveedor.productCount}</strong><span>Productos</span></div>
                <div className="main-stat-item"><BarChart2 size={18} /><strong>{proveedor.ordersShipped.toLocaleString('es-CL')}</strong><span>Ventas (30d)</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* --- SECCIÓN "PRODUCTOS MÁS VENDIDOS" --- */}
      {topProducts.length > 0 && (
        <div className="products-section top-sellers-section">
          <h3 className="section-title">Productos más vendidos</h3>
          <div className="products-grid">
            {topProducts.map((product) => (
              <ProductCard key={product.productId} product={product} darkMode={darkMode} />
            ))}
          </div>
        </div>
      )}

      {/* --- NUEVO ENCABEZADO PARA CONTROLES --- */}
      <div className="page-controls-header">
        <button onClick={onBack} className="back-button">
          <ArrowLeft size={20} />
          Volver a Proveedores
        </button>
        <div className="filter-container">
          <h3 className="section-title">Todos los productos</h3>
          <div className="category-filter">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="category-select"
            >
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="products-grid">
        {filteredProducts.length > 0 ? (
          filteredProducts.map((product) => (
            <ProductCard key={product.productId} product={product} darkMode={darkMode} />
          ))
        ) : (
          <p className="no-products-message">No hay productos disponibles para esta selección.</p>
        )}
      </div>
    </div>
  );
};

export default ProveedorDetalle;