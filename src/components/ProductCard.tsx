import React, { useMemo, useState } from 'react';
import './ProductCard.css';
import { rotateWeek } from '../utils/week';

export interface Product {
  name: string;
  providerName: string;
  stock: number;
  image: string;
  priceProvider: string;

  /** 🔥 Ventas reales últimos 7 días (total) */
  sales7d?: number;

  /** Serie real últimos 7 días (array de { day, sales }) */
  salesSeries?: { day: string; sales: number }[];

  /** Compat: si viene “sales” viejo lo seguimos usando como respaldo */
  sales?: number;

  totalStock?: number;
  productId?: number;
  demand?: number;
  providerUrl?: string;
  href?: string;
  categoryName?: string;
  rank?: number;
}

interface ProductCardProps {
  product: Product;
  darkMode: boolean;
}

/** Serie completa Lun..Dom desde la que venga; días faltantes = 0 */
const formatSalesDataForLast7Days = (
  salesData?: { day: string; sales: number }[]
): { day: string; sales: number }[] => {
  const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const today = new Date();
  const salesMap = new Map((salesData || []).map((i) => [i.day, i.sales]));
  const last7: { day: string; sales: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(today.getDate() - i);
    const name = dayNames[d.getDay()];
    last7.push({ day: name, sales: salesMap.get(name) ?? 0 });
  }
  return last7;
};

const generateChartData = (
  data: { day: string; sales: number }[],
  width: number,
  height: number
) => {
  if (!data || data.length < 2) return { linePath: '', areaPath: '', points: [] as any[] };
  const salesNumbers = data.map((d) => d.sales);
  const maxData = Math.max(...salesNumbers, 1);
  const stepX = width / (data.length - 1);
  const chartPoints = data.map((d, i) => ({
    x: i * stepX,
    y: height - (d.sales / maxData) * height * 0.8 - height * 0.1,
    ...d,
  }));
  const pathPoints = chartPoints.map((p) => `${p.x},${p.y}`);
  const linePath = `M ${pathPoints.join(' L ')}`;
  const areaPath = `${linePath} L ${width},${height} L 0,${height} Z`;
  return { linePath, areaPath, points: chartPoints };
};

const ProductCard: React.FC<ProductCardProps> = ({ product, darkMode }) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  // 1) Serie: real si viene; si no, 7 días en cero (nada de dummy "bonita")
  const preparedData = useMemo(() => {
    let base: { day: string; sales: number }[] =
      product.salesSeries && product.salesSeries.length > 0
        ? formatSalesDataForLast7Days(product.salesSeries)
        : [
            { day: 'Lun', sales: 0 },
            { day: 'Mar', sales: 0 },
            { day: 'Mié', sales: 0 },
            { day: 'Jue', sales: 0 },
            { day: 'Vie', sales: 0 },
            { day: 'Sáb', sales: 0 },
            { day: 'Dom', sales: 0 },
          ];
    return rotateWeek(base);
  }, [product.salesSeries]);

  // 2) % Demanda = días con ventas / 7 * 100 (si no hay serie pero hay total, se aproxima)
  const demandPercentage = useMemo(() => {
    if (product.demand != null) return product.demand;

    if (product.salesSeries && product.salesSeries.length > 0) {
      const daysWithSales = preparedData.filter((d) => d.sales > 0).length;
      return Math.round((daysWithSales / 7) * 100);
    }

    if (typeof product.sales7d === 'number') {
      const approxDays = Math.max(0, Math.min(7, Math.floor(product.sales7d)));
      return Math.round((approxDays / 7) * 100);
    }

    const legacy = product.sales ?? 0;
    const approxLegacyDays = Math.max(0, Math.min(7, Math.floor(legacy)));
    return Math.round((approxLegacyDays / 7) * 100);
  }, [product.demand, product.salesSeries, preparedData, product.sales7d, product.sales]);

  const { linePath, areaPath, points } = useMemo(
    () => generateChartData(preparedData, 100, 40),
    [preparedData]
  );

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const width = svg.clientWidth;
    const stepX = width / (points.length - 1);
    const index = Math.round(mouseX / stepX);
    setActiveIndex(index);
  };

  const activePoint =
    activeIndex !== null && points[activeIndex] ? points[activeIndex] : null;
  let tooltipTransform = 'translate(-50%, -150%)';
  if (activeIndex === 0) tooltipTransform = 'translate(0, -150%)';
  else if (activeIndex === points.length - 1)
    tooltipTransform = 'translate(-100%, -150%)';

  // Ventas a mostrar en la píldora (preferencia por real 7d)
  const salesToShow = product.sales7d ?? product.sales ?? 0;

  return (
    <div className="product-card">
      <a
        href={product.href || '#'}
        target="_blank"
        rel="noopener noreferrer"
        className="card-img-link"
      >
        <img
          src={product.image}
          alt={product.name}
          className="card-img"
          onError={(e) => {
            e.currentTarget.src = '/logohot.png';
          }}
        />
      </a>

      <div className="card-content">
        <a
          href={product.href || '#'}
          target="_blank"
          rel="noopener noreferrer"
          className="product-id"
        >
          #{product.productId ?? product.rank}
        </a>

        <h2 className="product-title">{product.name}</h2>

        <div className="meta-and-sales">
          <div className="product-meta-grid">
            <p className="product-meta">
              <span>Proveedor</span>
              {product.providerUrl ? (
                <a
                  href={product.providerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="provider-link"
                >
                  <strong>{product.providerName || '—'}</strong>
                </a>
              ) : (
                <strong>{product.providerName || '—'}</strong>
              )}
            </p>
            <p className="product-meta">
              <span>Stock</span> <strong>{product.stock}</strong>
            </p>
            <p className="product-meta product-meta-price">
              <span>Precio</span> <strong>{product.priceProvider}</strong>
            </p>
            <p className="product-meta">
              <span>Categoría</span>{' '}
              <strong>{product.categoryName || 'Sin categoría'}</strong>
            </p>
          </div>

          <div className="sales-pill" title="Ventas últimos 7 días">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
              <polyline points="17 6 23 6 23 12"></polyline>
            </svg>
            <span>{salesToShow} Ventas</span>
          </div>
        </div>
      </div>

      <div className="demand-bar">
        <div className="bar-container">
          <div className="bar-track"></div>
          <div className="bar-fill" style={{ width: `${demandPercentage}%` }}></div>
          <img
            src={darkMode ? '/logohot-truck-naranjo.png' : '/logohot-truck.png'}
            alt="Demanda"
            className="demand-truck"
            style={{
              left: `calc(${demandPercentage}% - 24px)`,
              transform: 'scale(1.25)',
            }}
          />
        </div>
        <span className="demand-label" style={{ marginTop: 6 }}>
          {demandPercentage}% Demanda
        </span>
      </div>

      <div className="sales-graph" onMouseLeave={() => setActiveIndex(null)}>
        {activePoint && (
          <div
            className="graph-tooltip"
            style={{ left: `${activePoint.x}%`, transform: tooltipTransform }}
          >
            {activePoint.day}: {activePoint.sales}
          </div>
        )}
        <svg viewBox="0 0 100 40" preserveAspectRatio="none" onMouseMove={handleMouseMove}>
          <defs>
            <linearGradient id="salesGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" className="gradient-start" />
              <stop offset="100%" className="gradient-end" />
            </linearGradient>
            <clipPath id="chartClip">
              <rect x="0" y="0" width="100" height="40" />
            </clipPath>
          </defs>
          <g clipPath="url(#chartClip)">
            <path className="sales-graph-area" d={areaPath} fill="url(#salesGradient)" />
            <path className="sales-graph-line" d={linePath} fill="none" />
            {activePoint && (
              <>
                <line className="graph-tracker-line" x1={activePoint.x} y1="16" x2={activePoint.x} y2="50" />
                <circle cx={activePoint.x} cy={activePoint.y} r="3" className="sales-graph-point-pulse" />
                <circle cx={activePoint.x} cy={activePoint.y} r="3" className="sales-graph-point-solid" />
              </>
            )}
          </g>
        </svg>
      </div>
    </div>
  );
};

export default ProductCard;
