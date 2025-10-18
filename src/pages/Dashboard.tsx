// Dashboard.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Moon, Sun } from "lucide-react";
import "./Dashboard.css";
import SubscriptionModal from "./SubscriptionModal";
import { Link } from "react-router-dom";

/* ================== Datos ================== */
export type Country = { code: string; name: string };

export const ALL_COUNTRIES: Country[] = [
  { code: "cl", name: "Chile" },
  { code: "ar", name: "Argentina" },
  { code: "pe", name: "Perú" },
  { code: "co", name: "Colombia" },
  { code: "mx", name: "México" },
  { code: "uy", name: "Uruguay" },
  { code: "ec", name: "Ecuador" },
  { code: "bo", name: "Bolivia" },
  { code: "py", name: "Paraguay" },
  { code: "br", name: "Brasil" },
  { code: "us", name: "Estados Unidos" },
  { code: "es", name: "España" },
];

type Producto = {
  id: string;
  name: string;
  image?: string;
  price?: number;
  provider?: string;
  href?: string;
  country?: string;
  category?: string;
};

export default function Dashboard() {
  /* ===== Tema ===== */
  const [dark, setDark] = useState(() => localStorage.getItem("theme:dark") === "1");
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("theme:dark", dark ? "1" : "0");
  }, [dark]);

  /* ===== Rol ===== */
  const isAdmin = typeof window !== "undefined" && sessionStorage.getItem("isAdmin") === "1";

  /* ===== País header (solo admin cambia) ===== */
  const [selectedCountry, setSelectedCountry] = useState<Country>({ code: "cl", name: "Chile" });
  const [openFlags, setOpenFlags] = useState(false);
  const flagsRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!flagsRef.current) return;
      if (!flagsRef.current.contains(e.target as Node)) setOpenFlags(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);
  const headerCountries = isAdmin ? ALL_COUNTRIES : [{ code: "cl", name: "Chile" }];

  /* ===== UI ===== */
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"hot" | "nichos" | "categorias">("hot");

  /* ===== Modal Suscripción ===== */
  const [openSub, setOpenSub] = useState(false);

  /* ===== Mock data ===== */
  const productos: Producto[] = useMemo(
    () => [
      { id: "1", name: "Mini Proyector Portátil", image: "/placeholder1.jpg", price: 39990, provider: "Dropi", country: "cl", category: "Gadgets" },
      { id: "2", name: "Faja Reductora Fit", image: "/placeholder2.jpg", price: 12990, provider: "Dropi", country: "cl", category: "Fitness" },
      { id: "3", name: "Lámpara Luna 3D", image: "/placeholder3.jpg", price: 14990, provider: "Dropi", country: "cl", category: "Decoración" },
    ],
    []
  );

  const filtrados = useMemo(() => {
    const q = query.trim().toLowerCase();
    return productos.filter((p) => {
      const roleOk = isAdmin ? true : (p.country ?? "cl") === "cl";
      const qOk = !q || p.name.toLowerCase().includes(q) || (p.category ?? "").toLowerCase().includes(q);
      return roleOk && qOk;
    });
  }, [productos, isAdmin, query]);

  return (
    <div className={dark ? "bg-body-dark min-h-screen" : "bg-body-light min-h-screen"}>
      <div className="dh-wrap">
        {/* ===== Header ===== */}
        <header className="dh-card dh-glow mt-6 mb-5">
          <div className="dh-header">
            <div className="dh-header__left">
              <img
                src={dark ? "/logohot-naranjo.png" : "/logohot-naranjo.png"}
                alt="DropHot"
                className="dh-logo"
              />
              <div>
                <div className="dh-kicker">Plataforma</div>
                <h1 className="dh-title">DropHot — Dashboard</h1>
                <p className="dh-sub">
                  Explora <b>tendencias</b>, <b>nichos</b> y <b>categorías</b> en tiempo real.
                </p>
              </div>
            </div>

            <div className="dh-header__right" ref={flagsRef}>
              <span className="dh-pill">{isAdmin ? "Acceso: Total" : "Acceso: Chile"}</span>

              {/* Selector país (bandera + menú) */}
              <div className="dh-country">
                <button
                  className={`dh-flag-btn ${!isAdmin ? "pointer-events-none opacity-90" : ""}`}
                  title={selectedCountry.name}
                  onClick={() => isAdmin && setOpenFlags((o) => !o)}
                >
                  <img src={`https://flagcdn.com/w40/${selectedCountry.code}.png`} alt={selectedCountry.name} />
                </button>

                {isAdmin && openFlags && (
                  <div className="dh-flag-menu">
                    {headerCountries.map((c) => (
                      <button
                        key={c.code}
                        className="dh-flag-option"
                        onClick={() => {
                          setSelectedCountry(c);
                          setOpenFlags(false);
                        }}
                        title={c.name}
                      >
                        <img src={`https://flagcdn.com/w40/${c.code}.png`} alt={c.name} />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Tema */}
              <button
                className="dh-theme-btn"
                aria-label="Cambiar tema"
                onClick={() => setDark((d) => !d)}
                title={dark ? "Modo claro" : "Modo oscuro"}
              >
                {dark ? <Sun size={18} /> : <Moon size={18} />}
              </button>
            </div>
          </div>
        </header>

        {/* ===== Toolbar (tabs + search) ===== */}
        <section className="dh-card dh-glow mb-6">
          <div className="dh-toolbar">
            <div className="dh-tabs">
              <button className={`dh-tab ${tab === "hot" ? "is-active" : ""}`} onClick={() => setTab("hot")}>
                Productos Hot
              </button>
              <button className={`dh-tab ${tab === "nichos" ? "is-active" : ""}`} onClick={() => setTab("nichos")}>
                Nichos
              </button>
              <button className={`dh-tab ${tab === "categorias" ? "is-active" : ""}`} onClick={() => setTab("categorias")}>
                Proveedores
              </button>

              {/* << CAMBIO: si es admin, Link a /admin/payments; si no, abre modal */}
              {isAdmin ? (
                <Link to="/admin/payments" className="dh-tab dh-tab-link">
                  Gestión de pagos
                </Link>
              ) : (
                <button className="dh-tab" onClick={() => setOpenSub(true)}>
                  Solicitud de suscripción
                </button>
              )}
            </div>

            <input
              className="dh-search"
              placeholder="Buscar producto o categoría..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </section>

        {/* ===== Grid ===== */}
        <main className="pb-10">
          {tab === "hot" && (
            <section className="dh-grid">
              {filtrados.map((p) => (
                <article key={p.id} className="dh-prod dh-glow-soft">
                  <div className="dh-prod__media">
                    {p.image ? <img src={p.image} alt={p.name} /> : null}
                  </div>
                  <div className="dh-prod__body">
                    <h3 className="dh-prod__title">{p.name}</h3>
                    <p className="dh-prod__meta">
                      {p.provider ?? "—"} • {(p.country ?? "CL").toUpperCase()} • {p.category ?? "—"}
                    </p>
                    <div className="dh-prod__ft">
                      <span className="dh-price">{p.price ? `$${p.price.toLocaleString("es-CL")}` : "—"}</span>
                      <span className="dh-btn-mini">Ver</span>
                    </div>
                  </div>
                </article>
              ))}
            </section>
          )}

          {tab === "nichos" && (
            <section className="dh-placeholder dh-card dh-glow-soft">
              Vista de <b>Nichos</b> lista para conectar.
            </section>
          )}

          {tab === "categorias" && (
            <section className="dh-placeholder dh-card dh-glow-soft">
              Vista de <b>Proveedores</b> lista para conectar.
            </section>
          )}
        </main>

        <footer className="dh-footer">© {new Date().getFullYear()} DropHot. Todos los derechos reservados.</footer>

        {/* ===== Modal (solo usuario) ===== */}
        {!isAdmin && (
          <SubscriptionModal
            open={openSub}
            onClose={() => setOpenSub(false)}
            onSubmit={(payload) => {
              console.log("Solicitud enviada:", payload);
              setOpenSub(false);
            }}
          />
        )}
      </div>
    </div>
  );
}
