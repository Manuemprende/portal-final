import React, { useMemo, useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
};

const COUNTRIES = [
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

export default function SubscriptionModal({ open, onClose, onSubmit }: Props) {
  const [fullName, setFullName] = useState("");
  const [dropEmail, setDropEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [shop, setShop] = useState("");
  const [pay, setPay] = useState<"wallet" | "transfer">("wallet");

  const [plan, setPlan] = useState<null | "vip" | "total">(null);

  // En VIP, CL es fijo. Puedes elegir 2 más.
  const vipPool = useMemo(() => COUNTRIES.filter(c => c.code !== "cl"), []);
  const [vipSelected, setVipSelected] = useState<string[]>([]);

  // Al cambiar plan limpiamos selección
  const handlePlan = (p: "vip" | "total") => {
    setPlan(p);
    setVipSelected([]);
  };

  const toggleVipCountry = (code: string) => {
    if (vipSelected.includes(code)) {
      setVipSelected(vipSelected.filter(c => c !== code));
    } else if (vipSelected.length < 2) {
      setVipSelected([...vipSelected, code]);
    }
  };

  const canSend =
    !!fullName &&
    !!dropEmail &&
    !!plan &&
    (plan === "vip" ? vipSelected.length === 2 : true);

  if (!open) return null;

  return (
    <div className="dh-modal">
      <div className="dh-modal__bg" onClick={onClose} />
      <div className="dh-modal__card dh-glow">
        <div className="dh-modal__head">
          <h3 style={{ margin: 0 }}>Solicitud de suscripción</h3>
          <button className="dh-x" onClick={onClose}>×</button>
        </div>

        {/* Formulario compacto */}
        <div className="dh-form grid-2">
          <input
            className="dh-input"
            placeholder="Nombre y apellido"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
          <input
            className="dh-input"
            placeholder="Correo de Dropdrop"
            value={dropEmail}
            onChange={(e) => setDropEmail(e.target.value)}
          />

          <input
            className="dh-input"
            placeholder="Teléfono (ej. +56 9 1234 5678)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <input
            className="dh-input"
            placeholder="Nombre de tienda (opcional)"
            value={shop}
            onChange={(e) => setShop(e.target.value)}
          />
        </div>

        {/* Método de pago */}
        <div className="dh-form grid-2">
          <select
            className="dh-input"
            value={pay}
            onChange={(e) => setPay(e.target.value as any)}
          >
            <option value="wallet">Saldo Wallet</option>
            <option value="transfer">Transferencia</option>
          </select>

          {/* Espacio */}
          <div />
        </div>

        {/* Planes */}
        <div className="plan-row">
          <div
            className={`plan-card ${plan === "vip" ? "is-active" : ""}`}
            onClick={() => handlePlan("vip")}
            role="button"
          >
            <div className="plan-title">Plan VIP</div>
            <div className="plan-price">$10.000</div>
            <div className="plan-note">Acceso a Chile + 2 países a elección</div>
            {plan === "vip" && (
              <div className="plan-counter">Selecciona 2 países adicionales</div>
            )}
          </div>

          <div
            className={`plan-card ${plan === "total" ? "is-active" : ""}`}
            onClick={() => handlePlan("total")}
            role="button"
          >
            <div className="plan-title">Plan Total</div>
            <div className="plan-price">$15.000</div>
            <div className="plan-note">Acceso a todos los países disponibles</div>
          </div>
        </div>

        {/* Países: aparecen solo al elegir plan */}
        {plan === "vip" && (
          <>
            <div className="flags-grid-title">Chile incluido + elige 2 adicionales:</div>
            <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
              <div className="flag-dot is-selected" title="Chile">
                <img src={`https://flagcdn.com/w40/cl.png`} alt="Chile" />
              </div>
            </div>

            <div className="flags-grid">
              {vipPool.map(c => (
                <button
                  key={c.code}
                  className={`flag-dot ${vipSelected.includes(c.code) ? "is-selected" : ""}`}
                  onClick={() => toggleVipCountry(c.code)}
                  title={c.name}
                >
                  <img src={`https://flagcdn.com/w40/${c.code}.png`} alt={c.name} />
                </button>
              ))}
            </div>
          </>
        )}

        {plan === "total" && (
          <>
            <div className="flags-grid-title">Países (todos incluidos)</div>
            <div className="flags-grid">
              {COUNTRIES.map(c => (
                <div key={c.code} className="flag-dot is-selected" title={c.name}>
                  <img src={`https://flagcdn.com/w40/${c.code}.png`} alt={c.name} />
                </div>
              ))}
            </div>
          </>
        )}

        {/* Mensaje */}
        <div className="mt-6">
          <textarea
            className="dh-textarea"
            placeholder="Cuéntanos brevemente tu caso..."
          />
        </div>

        {/* Acciones */}
        <div className="dh-actions">
          <button className="dh-btn ghost" onClick={onClose}>Cancelar</button>
          <button
            className="dh-btn primary"
            disabled={!canSend}
            onClick={() =>
              onSubmit({
                fullName,
                dropEmail,
                phone,
                shop,
                pay,
                plan,
                countries:
                  plan === "vip" ? ["cl", ...vipSelected] : COUNTRIES.map(c => c.code),
              })
            }
          >
            Enviar solicitud
          </button>
        </div>
      </div>
    </div>
  );
}
