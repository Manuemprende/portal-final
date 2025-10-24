
// Dashboard.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { Moon, Sun, TrendingUp, PackageSearch, Users, BarChart, Star, LogOut } from "lucide-react";
import "./Dashboard.css";
import SubscriptionModal from "./SubscriptionModal";
import ProductCard, { type Product } from "../components/ProductCard";
import { ALL_COUNTRIES, type Country } from "../countries";

export default function Dashboard() {
  const [dark, setDark] = useState(() => localStorage.getItem("theme:dark") === "1");
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("theme:dark", dark ? "1" : "0");
  }, [dark]);

  const isAdmin = typeof window !== "undefined" && sessionStorage.getItem("isAdmin") === "1";

  const [selectedCountry, setSelectedCountry] = useState<Country>({ code: "cl", name: "Chile" });
  const [openFlags, setOpenFlags] = useState(false);
  const flagsRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!flagsRef.current || !flagsRef.current.contains(e.target as Node)) setOpenFlags(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);
  const headerCountries = isAdmin ? ALL_COUNTRIES : [{ code: "cl", name: "Chile" }];

  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"hot" | "nichos" | "proveedores" | "metricas">("hot");

  const [openSub, setOpenSub] = useState(false);

  const handleLogout = () => {
    window.location.href = "/";
  };
  
  const productos: Product[] = useMemo(
    () => [
        { productId: 1, name: "Mini Proyector Portátil", image: "/placeholder1.jpg", priceProvider: "$39.990", providerName: "Dropi", stock: 120, categoryName: "Gadgets", sales7d: 23, demand: 85, salesSeries: [ { day: 'Lun', sales: 2 }, { day: 'Mar', sales: 5 }, { day: 'Mié', sales: 3 }, { day: 'Jue', sales: 8 }, { day: 'Vie', sales: 4 }, { day: 'Sáb', sales: 1 }, { day: 'Dom', sales: 0 } ] },
        { productId: 2, name: "Faja Reductora Fit", image: "/placeholder2.jpg", priceProvider: "$12.990", providerName: "Dropi", stock: 300, categoryName: "Fitness", sales7d: 45, demand: 92, salesSeries: [ { day: 'Lun', sales: 10 }, { day: 'Mar', sales: 8 }, { day: 'Mié', sales: 12 }, { day: 'Jue', sales: 5 }, { day: 'Vie', sales: 7 }, { day: 'Sáb', sales: 2 }, { day: 'Dom', sales: 1 } ] },
        { productId: 3, name: "Lámpara Luna 3D", image: "/placeholder3.jpg", priceProvider: "$14.990", providerName: "Dropi", stock: 80, categoryName: "Decoración", sales7d: 15, demand: 60, salesSeries: [ { day: 'Lun', sales: 1 }, { day: 'Mar', sales: 2 }, { day: 'Mié', sales: 4 }, { day: 'Jue', sales: 3 }, { day: 'Vie', sales: 2 }, { day: 'Sáb', sales: 3 }, { day: 'Dom', sales: 0 } ] },
    ],
    []
  );

  const filtrados = useMemo(() => {
    if (tab !== 'hot') return [];
    const q = query.trim().toLowerCase();
    if (!q) return productos;
    return productos.filter((p) => p.name.toLowerCase().includes(q) || (p.categoryName ?? "").toLowerCase().includes(q));
  }, [productos, query, tab]);

  return (
    <div className={dark ? "bg-body-dark min-h-screen" : "bg-body-light min-h-screen"}>
      <div className="dh-wrap pt-3">
        {/* -- Cabezal Principal -- */}
        <header className="dh-card dh-glow mb-4">
          <div className="dh-header">
            <div className="dh-header__left">
              <img src={"/logohot-naranjo.png"} alt="DropHot" className="dh-logo" />
              <div>
                <div className="dh-kicker">Plataforma</div>
                <h1 className="dh-title">DropHot</h1>
                <p className="dh-sub">Dashboard de Tendencias</p>
              </div>
            </div>
            <div className="dh-header__right" ref={flagsRef}>
              {!isAdmin && (
                <button className="dh-btn-plan" onClick={() => setOpenSub(true)}><Star size={16} /><span>Mejorar Plan</span></button>
              )}
              <div className="dh-country">
                <button className={`dh-flag-btn ${!isAdmin ? "pointer-events-none opacity-90" : ""}`} title={selectedCountry.name} onClick={() => isAdmin && setOpenFlags((o) => !o)}>
                  <img src={`https://flagcdn.com/w40/${selectedCountry.code}.png`} alt={selectedCountry.name} />
                  <span className="dh-country-name">{selectedCountry.name}</span>
                </button>
                {isAdmin && openFlags && (
                  <div className="dh-flag-menu">
                    {headerCountries.map((c) => (
                      <button key={c.code} className="dh-flag-option" onClick={() => { setSelectedCountry(c); setOpenFlags(false); }} title={c.name}>
                        <img src={`https://flagcdn.com/w40/${c.code}.png`} alt={c.name} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button className="dh-theme-btn" aria-label="Cambiar tema" onClick={() => setDark((d) => !d)} title={dark ? "Modo claro" : "Modo oscuro"}>
                {dark ? <Sun size={18} /> : <Moon size={18} />}
              </button>
              <button className="dh-theme-btn" aria-label="Cerrar sesión" onClick={handleLogout} title="Cerrar sesión">
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </header>

        {/* -- Barra de Herramientas Separada -- */}
        <section className="dh-card dh-glow mb-5">
          <div className="dh-toolbar">
            <input className="dh-search" placeholder="Buscar..." value={query} onChange={(e) => setQuery(e.target.value)} />
            <div className="dh-tabs">
              <button className={`dh-tab ${tab === "hot" ? "is-active" : ""}`} onClick={() => setTab("hot")}> <TrendingUp size={16} /> <span>Productos Hot</span> </button>
              <button className={`dh-tab ${tab === "nichos" ? "is-active" : ""}`} onClick={() => setTab("nichos")}> <PackageSearch size={16} /> <span>Nichos</span> </button>
              <button className={`dh-tab ${tab === "proveedores" ? "is-active" : ""}`} onClick={() => setTab("proveedores")}> <Users size={16} /> <span>Proveedores</span> </button>
              <button className={`dh-tab ${tab === "metricas" ? "is-active" : ""}`} onClick={() => setTab("metricas")}> <BarChart size={16} /> <span>Métricas</span> </button>
            </div>
          </div>
        </section>

        <main className="pb-6">
          {tab === "hot" && (
            <>
              {filtrados.length > 0 ? (
                <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {filtrados.map((p) => (
                    <ProductCard key={p.productId} product={p} darkMode={dark} />
                  ))}
                </section>
              ) : (
                <div className="dh-placeholder dh-card"> No se encontraron productos para tu búsqueda. </div>
              )}
            </>
          )}
          {tab === "nichos" && ( <div className="dh-placeholder dh-card"> Vista de <b>Nichos</b> lista para conectar. </div> )}
          {tab === "proveedores" && ( <div className="dh-placeholder dh-card"> Vista de <b>Proveedores</b> lista para conectar. </div> )}
          {tab === "metricas" && ( <div className="dh-placeholder dh-card"> Vista de <b>Métricas</b> lista para conectar. </div> )}
        </main>

        <footer className="dh-footer">© {new Date().getFullYear()} DropHot. Todos los derechos reservados.</footer>

        {!isAdmin && <SubscriptionModal open={openSub} onClose={() => setOpenSub(false)} onSubmit={(payload) => { console.log("Solicitud enviada:", payload); setOpenSub(false); }} />}
      </div>
    </div>
  );
}
