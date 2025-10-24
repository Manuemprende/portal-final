import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import { ALL_COUNTRIES, type Country } from "../countries";

interface SubscriptionModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: any) => void;
}

const AVAILABLE_FOR_VIP: Country[] = ALL_COUNTRIES.filter((c) => c.code !== "cl");

export default function SubscriptionModal({
  open,
  onClose,
  onSubmit,
}: SubscriptionModalProps) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", storeName: "", plan: "total", case: "" });
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);

  useEffect(() => {
    // Reset selected countries if plan changes away from VIP
    if (form.plan !== 'vip') {
      setSelectedCountries([]);
    }
  }, [form.plan]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleCountryToggle = (countryCode: string) => {
    setSelectedCountries((prev) => {
      if (prev.includes(countryCode)) {
        return prev.filter((c) => c !== countryCode);
      }
      if (prev.length < 2) {
        return [...prev, countryCode];
      }
      return prev; // Do not add more than 2
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ ...form, selectedCountries });
    onClose(); // Close modal on submit
  };

  if (!open) return null;

  return (
    <div className="sub-modal-backdrop" onClick={onClose}>
      <div className="sub-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="sub-modal-header">
          <h2 className="sub-modal-title">Solicitud de suscripción</h2>
          <button className="sub-modal-close" onClick={onClose} aria-label="Cerrar modal">
            <X size={24} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="sub-modal-body">
            <div className="sub-modal-grid">
              <div className="sub-modal-field">
                <label className="sub-modal-label" htmlFor="name">Nombre y apellido</label>
                <input className="sub-modal-input" type="text" id="name" name="name" value={form.name} onChange={handleChange} required />
              </div>
              <div className="sub-modal-field">
                <label className="sub-modal-label" htmlFor="email">Correo de Dropdrop</label>
                <input className="sub-modal-input" type="email" id="email" name="email" value={form.email} onChange={handleChange} required />
              </div>
              <div className="sub-modal-field">
                <label className="sub-modal-label" htmlFor="phone">Teléfono (ej. +56 9 1234 5678)</label>
                <input className="sub-modal-input" type="tel" id="phone" name="phone" value={form.phone} onChange={handleChange} required />
              </div>
              <div className="sub-modal-field">
                <label className="sub-modal-label" htmlFor="storeName">Nombre de tienda (opcional)</label>
                <input className="sub-modal-input" type="text" id="storeName" name="storeName" value={form.storeName} onChange={handleChange} />
              </div>
            </div>

            <div className="sub-modal-field">
              <label className="sub-modal-label" htmlFor="plan">Plan</label>
              <div className="sub-modal-select-wrapper">
                 <select className="sub-modal-select" id="plan" name="plan" value={form.plan} onChange={handleChange}>
                    <option value="total">Plan Total ($15.000) - Acceso a todos los países disponibles</option>
                    <option value="vip">Plan VIP ($10.000) - Acceso a Chile + 2 países a elección</option>
                 </select>
              </div>
            </div>

            {form.plan === 'vip' && (
              <div className="sub-modal-field">
                <label className="sub-modal-label">Elige 2 países (límite: {selectedCountries.length}/2)</label>
                <div className="country-selector-grid">
                  {AVAILABLE_FOR_VIP.map((country) => (
                    <div 
                      key={country.code} 
                      className={`country-item ${selectedCountries.includes(country.code) ? 'selected' : ''}`}
                      onClick={() => handleCountryToggle(country.code)}
                    >
                      <img src={`https://flag.vercel.app/m/${country.code.toUpperCase()}.svg`} alt={country.name} />
                      <span>{country.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="sub-modal-field">
              <label className="sub-modal-label" htmlFor="case">Cuéntanos brevemente tu caso...</label>
              <textarea className="sub-modal-textarea" id="case" name="case" value={form.case} onChange={handleChange} rows={3}></textarea>
            </div>
          </div>

          <div className="sub-modal-footer">
            <button type="button" className="sub-modal-btn cancel" onClick={onClose}>Cancelar</button>
            <button type="submit" className="sub-modal-btn submit">Enviar solicitud</button>
          </div>
        </form>
      </div>
    </div>
  );
}
