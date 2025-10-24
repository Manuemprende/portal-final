import React, { useState, useMemo, useEffect } from 'react';
import { ArrowLeft, Package, BarChart2 } from 'lucide-react';
import ProductCard from '../components/ProductCard';
import './ProveedorDetalle.css';
import { ProveedorInfo } from './Proveedores'; 
import { fetchHotProducts, HotProduct } from '../services/hot';
import { useCountryStore } from '../state/useCountry';

interface ProveedorDetalleProps {
  proveedor: ProveedorInfo;
  onBack: () => void;
  darkMode: boolean;
}

// Helper to convert HotProduct to the format ProductCard expects
const toCardProduct = (p: HotProduct) => ({
  productId: p.prod_id || p.product_id || p.id || -1,
  name: p.name,
  imageUrl: p.image_url || p.picture || '',
  price: p.price,
  sales7d: p.sales_7d,
  rank: p.hot_rank || p.rank,
  href: '#',
  category: p.category_name,
});

const ProveedorDetalle: React.FC<ProveedorDetalleProps> = ({ proveedor, onBack, darkMode }) => {
  const [allProducts, setAllProducts] = useState<HotProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  const { country } = useCountryStore();

  useEffect(() => {
    setLoading(true);
    (async () => {
      const products = await fetchHotProducts({ country, limit: 1000 });
      const providerProducts = products.filter(p => p.provider_id === proveedor.id);
      setAllProducts(providerProducts);
      setLoading(false);
    })();
  }, [proveedor.id, country]);

  const topProducts = useMemo(() => {
    return [...allProducts]
      .sort((a, b) => (b.sales_7d || 0) - (a.sales_7d || 0))
      .slice(0, 4);
  }, [allProducts]);

  const categories = useMemo(() => {
    const productCategories = allProducts.map(p => p.category_name).filter(Boolean) as string[];
    return ['Todas', ...new Set(productCategories)];
  }, [allProducts]);

  const filteredProducts = useMemo(() => {
    let products = allProducts;
    if (selectedCategory !== 'Todas') {
      products = products.filter(p => p.category_name === selectedCategory);
    }
    return products.sort((a, b) => (b.sales_7d || 0) - (a.sales_7d || 0));
  }, [allProducts, selectedCategory]);

  return (
    <div className="proveedor-detalle-page">
      <div className="proveedor-info-banner">
        <div className="info-top">
          {/* Assuming logoUrl and other info are passed correctly in ProveedorInfo */}
          <img src={proveedor.logoUrl} alt={proveedor.name} className="banner-logo" />
          <div className="provider-details">
            <div className="provider-title-line">
              <h2 className="provider-name">{proveedor.name}</h2>
              <div className="provider-main-stats">
                <div className="main-stat-item"><Package size={18} /><strong>{allProducts.length}</strong><span>Productos</span></div>
                <div className="main-stat-item"><BarChart2 size={18} /><strong>{proveedor.ordersShipped.toLocaleString('es-CL')}</strong><span>Ventas (30d)</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {loading ? <div className="loading-more">Cargando productos...</div> : <>
        {topProducts.length > 0 && (
          <div className="products-section top-sellers-section">
            <h3 className="section-title">Productos más vendidos</h3>
            <div className="products-grid">
              {topProducts.map((product) => (
                <ProductCard key={product.prod_id} product={toCardProduct(product)} darkMode={darkMode} />
              ))}
            </div>
          </div>
        )}

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
              <ProductCard key={product.prod_id} product={toCardProduct(product)} darkMode={darkMode} />
            ))
          ) : (
            <p className="no-products-message">No hay productos disponibles para esta selección.</p>
          )}
        </div>
      </>}
    </div>
  );
};

export default ProveedorDetalle;
