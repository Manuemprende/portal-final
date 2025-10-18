import React, { useState, useEffect, useMemo } from "react";
// Se agregaron Globe y Star para los iconos de plan
import { Search, Users, CreditCard, Check, X, Clock, Mail, Calendar, DollarSign, Moon, Sun, Plus, Minus, Globe, Star } from "lucide-react"; 

type User = {
  id: string;
  email: string;
  subscription_status: string | null;
  country_access: string[] | null;
  access_expires_at: string | null;
  balance_cents: number;
  created_at: string;
};

type AccessRequest = {
  id: string;
  user_email: string;
  countries: string[];
  status: "pending" | "approved" | "rejected";
  created_at: string;
  note?: string;
};

const METHODS = ["TRANSFER", "MERCADO_PAGO", "BALANCE"] as const;
type Method = (typeof METHODS)[number];

const COUNTRIES = [
  { code: "cl", name: "Chile" },
  { code: "co", name: "Colombia" },
  { code: "mx", name: "México" },
  { code: "pa", name: "Panamá" },
  { code: "ec", name: "Ecuador" },
  { code: "pe", name: "Perú" },
  { code: "py", name: "Paraguay" },
  { code: "ar", name: "Argentina" },
  { code: "gt", name: "Guatemala" },
  { code: "es", name: "España" },
  { code: "us", name: "Estados Unidos" },
  { code: "br", name: "Brasil" },
  { code: "uy", name: "Uruguay" },
];

// Tasa de cambio ficticia para el cálculo en USD
const CLP_TO_USD_RATE = 950; 

// Definición de los planes
const PLANS = {
  vip: {
    id: "vip",
    name: "Plan VIP",
    price: 1099000, // Valor en centavos de dólar ($10.990 CLP) -> $10990.00
    // Formato CLP: $10.990 (se usa replace para asegurar el punto como separador de miles y sin decimales)
    displayPriceCLP: (10990).toLocaleString('es-CL', { minimumFractionDigits: 0 }).replace(/(\d),(\d{3})/g, '$1.$2'),
    // Cálculo USD: (10990 / 950) = 11.57 USD
    displayPriceUSD: (10990 / CLP_TO_USD_RATE).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }),
    description: "Acceso a Chile más 2 países a elección",
    maxCountries: 2, // Máximo de países adicionales
  },
  total: {
    id: "total",
    name: "Plan Total",
    price: 1499000, // Valor en centavos de dólar ($14.990 CLP) -> $14990.00
    // Formato CLP: $14.990
    displayPriceCLP: (14990).toLocaleString('es-CL', { minimumFractionDigits: 0 }).replace(/(\d),(\d{3})/g, '$1.$2'),
    // Cálculo USD: (14990 / 950) = 15.78 USD
    displayPriceUSD: (14990 / CLP_TO_USD_RATE).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }),
    description: "Acceso a TODOS los países disponibles",
    maxCountries: COUNTRIES.length, // Acceso a todos
  },
};
type PlanId = keyof typeof PLANS;

export default function AdminPayments() {
  const [activeTab, setActiveTab] = useState<"users" | "requests" | "payment">("users");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [users, setUsers] = useState<User[]>([]);
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [darkMode, setDarkMode] = useState(true);
  
  const [email, setEmail] = useState("");
  // Estado inicial vacío para países
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  
  // NUEVO ESTADO: Para manejar el plan seleccionado.
  const [selectedPlan, setSelectedPlan] = useState<PlanId | null>(null);

  const [method, setMethod] = useState<Method>("TRANSFER");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const currentPlan = selectedPlan ? PLANS[selectedPlan] : null;

  useEffect(() => {
    const mockUsers: User[] = [
      { id: "1", email: "usuario1@example.com", subscription_status: "active", country_access: ["cl", "ar"], access_expires_at: "2025-12-31", balance_cents: 5000, created_at: "2024-01-15" },
      { id: "2", email: "usuario2@example.com", subscription_status: "active", country_access: ["mx", "co"], access_expires_at: "2025-11-20", balance_cents: 0, created_at: "2024-03-20" },
      { id: "3", email: "usuario3@example.com", subscription_status: "expired", country_access: ["cl"], access_expires_at: "2024-10-01", balance_cents: 15000, created_at: "2023-12-10" },
      { id: "4", email: "usuario4@example.com", subscription_status: ["active", "expired"][Math.floor(Math.random() * 2)] as any, country_access: ["pe", "cl"], access_expires_at: "2025-09-15", balance_cents: 2500, created_at: "2024-05-10" },
      { id: "5", email: "usuario5@example.com", subscription_status: "active", country_access: ["br", "ar"], access_expires_at: "2025-08-20", balance_cents: 7500, created_at: "2024-02-05" },
      { id: "6", email: "usuario6@example.com", subscription_status: ["active", "expired"][Math.floor(Math.random() * 2)] as any, country_access: ["uy"], access_expires_at: "2024-09-10", balance_cents: 0, created_at: "2023-11-15" },
      { id: "7", email: "usuario7@example.com", subscription_status: ["active", "expired"][Math.floor(Math.random() * 2)] as any, country_access: ["co"], access_expires_at: "2025-10-15", balance_cents: 1000, created_at: "2024-01-20" },
    ];
    setUsers(mockUsers);

    const mockRequests: AccessRequest[] = [
      { id: "1", user_email: "nuevo@example.com", countries: ["cl", "pe"], status: "pending", created_at: "2025-10-15", note: "Necesito acceso urgente para proyecto" },
      { id: "2", user_email: "usuario5@example.com", countries: ["mx"], status: "pending", created_at: "2025-10-17" },
      { id: "3", user_email: "empresa@example.com", countries: ["cl", "co", "ar"], status: "pending", created_at: "2025-10-16", note: "Solicitud corporativa - 5 usuarios" }
    ];
    setRequests(mockRequests);
  }, []);

  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const matchesSearch = user.email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === "all" || user.subscription_status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [users, searchTerm, statusFilter]);

  async function applyPayment() {
    try {
      setBusy(true);
      setMsg(null);
      
      // Siempre incluimos CL si seleccionamos países.
      const countriesToGrant = selectedCountries.includes("cl") ? selectedCountries : ["cl", ...selectedCountries];
      
      if (!email || !selectedPlan || countriesToGrant.length === 0) {
        setMsg("❌ Completa todos los campos: Email, Plan y Países.");
        return;
      }

      const additionalCountriesCount = countriesToGrant.filter(c => c !== "cl").length;
      if (currentPlan?.id === "vip" && additionalCountriesCount > PLANS.vip.maxCountries) {
        setMsg(`❌ El Plan VIP solo permite seleccionar ${PLANS.vip.maxCountries} países adicionales.`);
        return;
      }
      if (currentPlan?.id === "total" && countriesToGrant.length !== COUNTRIES.length) {
         setMsg(`❌ El Plan Total debe incluir todos los países.`);
        return;
      }
      
      // Simulación de la aplicación del pago/acceso
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const planName = currentPlan?.name || "Pago Manual";
      const grantedCountries = countriesToGrant.map(c => c.toUpperCase()).join(', ');
      
      setMsg(`✅ Acceso actualizado para ${email} con ${planName}. Países: ${grantedCountries}.`);

      // Resetear estados
      setEmail("");
      setNote("");
      setSelectedCountries([]);
      setSelectedPlan(null);

    } catch (e) {
      setMsg("❌ Error inesperado");
    } finally {
      setBusy(false);
    }
  }

  async function handleRequestAction(requestId: string, action: "approve" | "reject") {
    setRequests(prev => 
      prev.map(req => 
        req.id === requestId ? { ...req, status: action === "approve" ? "approved" : "rejected" } : req
      )
    );
  }

  const toggleCountry = (countryCode: string) => {
    setSelectedCountries(prev => 
      prev.includes(countryCode) ? prev.filter(c => c !== countryCode) : [...prev, countryCode]
    );
  };

  const FlagCircle = ({ code, size = "sm" }: { code: string; size?: "sm" | "md" }) => {
    const country = COUNTRIES.find(c => c.code === code);
    const sizeClass = size === "sm" ? "w-5 h-5" : "w-7 h-7";
    return (
      <div className={`${sizeClass} rounded-full overflow-hidden border border-white/20 flex-shrink-0`} title={country?.name}>
        <img 
          src={`https://flagcdn.com/w40/${code}.png`} 
          alt={country?.name}
          className="w-full h-full object-cover"
        />
      </div>
    );
  };

  const getStatusBadge = (status: string | null) => {
    const styles = {
      active: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
      expired: "bg-red-500/20 text-red-300 border-red-500/30",
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${styles[status as keyof typeof styles] || "bg-slate-500/20 text-slate-300 border-slate-500/30"}`}>
        {status === "active" ? "Activo" : status === "expired" ? "Expirado" : "—"}
      </span>
    );
  };

  const activeUsers = users.filter(u => u.subscription_status === "active").length;
  const pendingRequests = requests.filter(r => r.status === "pending").length;

  const bgClass = darkMode ? "bg-gradient-to-br from-[#092F64] via-[#1A5799] to-[#092F64]" : "bg-gradient-to-br from-slate-50 to-slate-100";
  const cardBg = darkMode ? "bg-[#1F1F1F]/40" : "bg-white";
  const textPrimary = darkMode ? "text-white" : "text-slate-900";
  const textSecondary = darkMode ? "text-slate-400" : "text-slate-600";
  const inputBg = darkMode ? "bg-[#0D1F3C]/60" : "bg-white";
  const borderColor = darkMode ? "border-white/10" : "border-slate-300";
  const accentColor = "#468BE6";

  const isCountryDisabled = (countryCode: string) => {
    const isSelected = selectedCountries.includes(countryCode);
    
    // Si no hay plan seleccionado o es el Plan Total, no hay deshabilitación 
    if (!selectedPlan || selectedPlan === 'total') {
        return false;
    }
    
    // Si es Plan VIP:
    if (selectedPlan === 'vip') {
        // Chile siempre es seleccionable/deseleccionable, pero no cuenta para el límite
        if (countryCode === 'cl') return false; 
        
        const additionalCount = selectedCountries.filter(c => c !== 'cl').length;
        // Si ya se seleccionaron 2 adicionales, y este país no está seleccionado, deshabilitar.
        return additionalCount >= PLANS.vip.maxCountries && !isSelected;
    }
    
    return false;
  };
  
  // Lógica para preseleccionar/limpiar países al cambiar de plan
  useEffect(() => {
      if (selectedPlan === 'total') {
          // Si es Total, forzamos la selección de todos.
          setSelectedCountries(COUNTRIES.map(c => c.code));
      } else if (selectedPlan === 'vip') {
          // Si es VIP, aseguramos que Chile esté seleccionado y limpiamos cualquier exceso.
          const currentCountries = selectedCountries.filter(c => c !== 'cl').slice(0, PLANS.vip.maxCountries);
          setSelectedCountries(['cl', ...currentCountries]);
      } else {
          // Si no hay plan seleccionado, se limpia la selección.
          setSelectedCountries([]);
      }
  }, [selectedPlan]);
  
  // Lógica para asegurar que se cumple el límite de Plan VIP
  useEffect(() => {
    if (selectedPlan === 'vip') {
        const additional = selectedCountries.filter(c => c !== 'cl');
        if (additional.length > PLANS.vip.maxCountries) {
            // Re-establecer la selección para cumplir con el límite
            setSelectedCountries(['cl', ...additional.slice(0, PLANS.vip.maxCountries)]);
        }
    }
  }, [selectedCountries, selectedPlan]);


  return (
    <div className={`min-h-screen ${bgClass} p-4 md:p-6`}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="flex items-center justify-between mb-6">
          <div>
            <h1 className={`text-2xl md:text-3xl font-bold ${textPrimary}`}>Panel de Administración</h1>
            <p className={`${textSecondary} text-sm`}>Gestiona pagos, accesos y solicitudes de usuarios</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setDarkMode(!darkMode)} className={`p-2 rounded-lg ${inputBg} ${textPrimary} border ${borderColor} hover:bg-opacity-80`}>
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <a href="/admin" className={`px-4 py-2 rounded-lg ${inputBg} ${textPrimary} border ${borderColor} hover:bg-opacity-80 text-sm`}>
              ← Volver
            </a>
          </div>
        </header>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-gradient-to-br from-[#468BE6] to-[#1A5799] rounded-xl p-5 text-white shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-100 mb-1">Usuarios Activos</p>
                <p className="text-3xl font-bold">{activeUsers}</p>
              </div>
              <Users className="w-10 h-10 text-blue-200 opacity-70" />
            </div>
          </div>
          <div className="bg-gradient-to-br from-[#93BFEF] to-[#468BE6] rounded-xl p-5 text-white shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-100 mb-1">Solicitudes Pendientes</p>
                <p className="text-3xl font-bold">{pendingRequests}</p>
              </div>
              <Clock className="w-10 h-10 text-blue-200 opacity-70" />
            </div>
          </div>
          <div className="bg-gradient-to-br from-[#1A5799] to-[#092F64] rounded-xl p-5 text-white shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-100 mb-1">Total Usuarios</p>
                <p className="text-3xl font-bold">{users.length}</p>
              </div>
              <CreditCard className="w-10 h-10 text-blue-200 opacity-70" />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className={`flex gap-2 mb-6 ${cardBg} backdrop-blur-sm rounded-xl p-2 border ${borderColor}`}>
          <button onClick={() => setActiveTab("users")} className={`flex-1 px-4 py-2.5 rounded-lg font-medium transition-all text-sm ${activeTab === "users" ? "bg-[#468BE6] text-white shadow-lg" : `${textSecondary} hover:bg-[#468BE6]/10`}`}>
            <Users className="w-4 h-4 inline mr-2" />
            Usuarios Suscritos
          </button>
          <button onClick={() => setActiveTab("requests")} className={`flex-1 px-4 py-2.5 rounded-lg font-medium transition-all relative text-sm ${activeTab === "requests" ? "bg-[#468BE6] text-white shadow-lg" : `${textSecondary} hover:bg-[#468BE6]/10`}`}>
            <Clock className="w-4 h-4 inline mr-2" />
            Solicitudes de Acceso
            {pendingRequests > 0 && (
              <span className="absolute -top-1 -right-1 bg-[#93BFEF] text-[#092F64] text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                {pendingRequests}
              </span>
            )}
          </button>
          <button onClick={() => setActiveTab("payment")} className={`flex-1 px-4 py-2.5 rounded-lg font-medium transition-all text-sm ${activeTab === "payment" ? "bg-[#468BE6] text-white shadow-lg" : `${textSecondary} hover:bg-[#468BE6]/10`}`}>
            <CreditCard className="w-4 h-4 inline mr-2" />
            Registrar Pago
          </button>
        </div>

        {/* Content */}
        <div className={`${cardBg} backdrop-blur-sm rounded-xl border ${borderColor} p-6`}>
          {/* Users Tab (Contenido anterior) */}
          {activeTab === "users" && (
            <div>
              <div className="flex flex-col md:flex-row gap-4 mb-5">
                <div className="flex-1 relative">
                  <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${textSecondary}`} />
                  <input
                    type="text"
                    placeholder="Buscar por email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={`w-full pl-10 pr-4 py-2.5 text-sm ${inputBg} border ${borderColor} rounded-lg ${textPrimary} placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#468BE6]`}
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className={`px-4 py-2.5 text-sm ${inputBg} border ${borderColor} rounded-lg ${textPrimary} focus:outline-none focus:ring-2 focus:ring-[#468BE6]`}
                >
                  <option value="all">Todos los estados</option>
                  <option value="active">Activos</option>
                  <option value="expired">Expirados</option>
                </select>
              </div>

              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                {filteredUsers.map((user) => (
                  <div key={user.id} className={`${inputBg} border ${borderColor} rounded-lg p-4 hover:bg-opacity-80 transition-all`}>
                    <div className="flex items-center gap-3 mb-3">
                      <Mail className="w-4 h-4 text-[#468BE6]" />
                      <h3 className={`text-sm font-semibold ${textPrimary}`}>{user.email}</h3>
                      {getStatusBadge(user.subscription_status)}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className={`${textSecondary} text-xs mb-1.5`}>Países</p>
                        <div className="flex gap-1.5 flex-wrap">
                          {user.country_access?.map(c => <FlagCircle key={c} code={c} />) || "—"}
                        </div>
                      </div>
                      <div>
                        <p className={`${textSecondary} text-xs mb-1`}>Expira</p>
                        <p className={`${textPrimary} font-medium text-sm`}>{user.access_expires_at || "—"}</p>
                      </div>
                      <div>
                        <p className={`${textSecondary} text-xs mb-1`}>Saldo</p>
                        <p className="text-[#93BFEF] font-medium text-sm">${(user.balance_cents / 100).toFixed(2)}</p>
                      </div>
                      <div>
                        <p className={`${textSecondary} text-xs mb-1`}>Miembro desde</p>
                        <p className={`${textPrimary} font-medium text-sm`}>{user.created_at}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Requests Tab (Contenido anterior) */}
          {activeTab === "requests" && (
            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              {requests.filter(r => r.status === "pending").map((request) => (
                <div key={request.id} className={`${inputBg} border ${borderColor} rounded-lg p-5`}>
                  <div className="flex items-center gap-2 mb-3">
                    <Mail className="w-4 h-4 text-[#468BE6]" />
                    <h3 className={`text-base font-semibold ${textPrimary}`}>{request.user_email}</h3>
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar className={`w-3.5 h-3.5 ${textSecondary}`} />
                    <p className={`${textSecondary} text-xs`}>Solicitud creada: {request.created_at}</p>
                  </div>
                  <div className="flex gap-2 items-center mb-3 flex-wrap">
                    <span className={`${textSecondary} text-xs`}>Países solicitados:</span>
                    <div className="flex gap-2">
                      {request.countries.map(c => (
                        <div key={c} className="flex items-center gap-1.5 px-2 py-1 bg-[#468BE6]/20 rounded-lg border border-[#468BE6]/30">
                          <FlagCircle code={c} />
                          <span className="text-[#93BFEF] text-xs font-medium">{c.toUpperCase()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {request.note && (
                    <div className={`p-3 ${darkMode ? 'bg-[#092F64]/30' : 'bg-slate-100'} rounded-lg border ${darkMode ? 'border-[#468BE6]/20' : 'border-slate-300'} mb-3`}>
                      <p className={`${textSecondary} text-xs italic`}>"{request.note}"</p>
                    </div>
                  )}
                  <div className="flex gap-3">
                    <button onClick={() => handleRequestAction(request.id, "approve")} className="flex-1 px-4 py-2.5 bg-[#468BE6] hover:bg-[#1A5799] text-white rounded-lg font-medium transition-all flex items-center justify-center gap-2 text-sm">
                      <Check className="w-4 h-4" />Aprobar
                    </button>
                    <button onClick={() => handleRequestAction(request.id, "reject")} className={`flex-1 px-4 py-2.5 ${inputBg} hover:bg-[#092F64] ${textPrimary} rounded-lg font-medium transition-all flex items-center justify-center gap-2 border ${borderColor} text-sm`}>
                      <X className="w-4 h-4" />Rechazar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Payment Tab - MODIFICADO para planes y precios */}
          {activeTab === "payment" && (
            <div className="max-w-3xl mx-auto"> 
              <div className="space-y-6">
                
                {/* Email Input */}
                <label className="block">
                  <span className={`text-xs ${textSecondary} mb-2 block flex items-center gap-1.5`}>
                    <Mail className="w-3.5 h-3.5" />Correo usuario
                  </span>
                  <input
                    type="email"
                    className={`w-full px-3 py-2.5 text-sm ${inputBg} border ${borderColor} rounded-lg ${textPrimary} placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#468BE6]`}
                    placeholder="usuario@correo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
                
                {/* SECCIÓN: Selección de Plan */}
                <div>
                  <h3 className={`text-sm font-semibold ${textPrimary} mb-3 flex items-center gap-2`}>
                    <DollarSign className="w-4 h-4 text-[#93BFEF]" /> Seleccionar Plan de Suscripción
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.values(PLANS).map(plan => (
                      <button
                        key={plan.id}
                        type="button" // Es importante para evitar el submit
                        onClick={() => setSelectedPlan(plan.id as PlanId)}
                        className={`p-5 rounded-xl border-2 transition-all text-left ${
                          selectedPlan === plan.id
                            ? "border-[#468BE6] bg-[#0D1F3C]/80 ring-2 ring-[#93BFEF]/50"
                            : `${inputBg} ${borderColor} hover:border-[#468BE6]/50`
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                            <div>
                                <h4 className={`font-bold text-lg ${textPrimary}`}>{plan.name}</h4>
                            </div>
                            <div className="text-right">
                                {/* Precio Principal (CLP) */}
                                <span className={`text-xl font-extrabold block ${selectedPlan === plan.id ? 'text-[#93BFEF]' : textPrimary}`}>
                                    ${plan.displayPriceCLP} 
                                </span>
                                {/* Precio Dólar (más pequeño) */}
                                <span className={`text-xs block ${textSecondary}`}>
                                    ~ {plan.displayPriceUSD}
                                </span>
                            </div>
                        </div>
                        <p className={`text-xs ${textSecondary} mb-3`}>{plan.description}</p>
                        <div className={`text-xs font-medium ${selectedPlan === plan.id ? 'text-[#93BFEF]' : textSecondary} flex items-center gap-1.5`}>
                            {plan.id === 'vip' ? <Star className="w-3 h-3" /> : <Globe className="w-3 h-3" />}
                            {plan.id === 'vip' ? `Acceso a CL + ${PLANS.vip.maxCountries} adicionales` : 'Acceso a todos los países'}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sección de Países (Aparece solo si hay un plan seleccionado) */}
                {selectedPlan && (
                    <label className="block mt-4">
                      <span className={`text-xs ${textSecondary} mb-2 block`}>
                          Países (Preseleccionado: CL. Selecciona {currentPlan?.id === 'vip' ? `${PLANS.vip.maxCountries - selectedCountries.filter(c => c !== 'cl').length} países adicionales restantes` : 'todos los países'})
                      </span>
                      <div className="grid grid-cols-7 md:grid-cols-13 gap-2">
                        {COUNTRIES.map(country => {
                           const isSelected = selectedCountries.includes(country.code);
                           const isDisabled = isCountryDisabled(country.code);

                           return (
                             <button
                                key={country.code}
                                type="button"
                                onClick={() => toggleCountry(country.code)}
                                disabled={isDisabled && !isSelected}
                                className={`p-2 rounded-lg transition-all border ${
                                  isSelected
                                    ? "bg-[#468BE6] border-[#468BE6] ring-2 ring-[#93BFEF]/50"
                                    : `${inputBg} ${borderColor} hover:border-[#468BE6] ${isDisabled ? 'opacity-40 cursor-not-allowed' : ''}`
                                }`}
                                title={country.name}
                              >
                                <FlagCircle code={country.code} size="md" />
                              </button>
                           );
                        })}
                      </div>
                    </label>
                )}
                
                {/* Sección de Método y Nota */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="block">
                    <span className={`text-xs ${textSecondary} mb-2 block flex items-center gap-1.5`}>
                      <CreditCard className="w-3.5 h-3.5" />Método
                    </span>
                    <select className={`w-full px-3 py-2.5 text-sm ${inputBg} border ${borderColor} rounded-lg ${textPrimary} focus:outline-none focus:ring-2 focus:ring-[#468BE6]`} value={method} onChange={(e) => setMethod(e.target.value as Method)}>
                      {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </label>

                  <label className="block">
                    <span className={`text-xs ${textSecondary} mb-2 block`}>Nota (opcional)</span>
                    <input className={`w-full px-3 py-2.5 text-sm ${inputBg} border ${borderColor} rounded-lg ${textPrimary} placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#468BE6]`} placeholder="nro de transferencia / referencia" value={note} onChange={(e) => setNote(e.target.value)} />
                  </label>
                </div>

                <button onClick={applyPayment} disabled={busy || !selectedPlan} className={`w-full px-5 py-3 rounded-lg font-semibold text-white transition-all ${busy || !selectedPlan ? "bg-slate-600 cursor-not-allowed" : "bg-gradient-to-r from-[#468BE6] to-[#1A5799] hover:from-[#1A5799] hover:to-[#092F64] shadow-lg shadow-[#468BE6]/50"}`}>
                  {busy ? "Aplicando..." : `✓ Aplicar ${currentPlan ? currentPlan.name : 'Pago'}`}
                </button>

                {msg && (
                  <div className={`rounded-lg px-4 py-3 text-sm font-medium ${msg.includes("✅") ? "bg-[#468BE6]/20 text-[#93BFEF] border border-[#468BE6]/30" : `${inputBg} ${textPrimary} border ${borderColor}`}`}>
                    {msg}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #468BE6;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #1A5799;
        }
      `}</style>
    </div>
  );
}