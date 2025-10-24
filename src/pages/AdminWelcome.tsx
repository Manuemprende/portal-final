import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { checkUserSession } from "../services/auth";

type Profile = {
  role: "admin" | "user";
  allowed_countries: string[];
  plan: string | null;
  email: string | null;
};

export default function AdminWelcome() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    (async () => {
      const { user, profile } = await checkUserSession();
      if (!user || !profile) {
        navigate("/"); // sin sesión → al inicio normal
        return;
      }
      const p = profile as Profile;
      if (p.role !== "admin") {
        navigate("/"); // usuarios normales → inicio normal
        return;
      }
      setIsAdmin(true);
      setEmail(p.email ?? user.email ?? null);
      setLoading(false);
    })();
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-100 via-blue-100 to-indigo-100">
        <div className="animate-pulse text-slate-600">Cargando…</div>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-sky-100 via-blue-100 to-indigo-100">
      <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-8 p-6">
        {/* Lado izquierdo: logo/ilustración */}
        <div className="bg-white/90 rounded-3xl shadow-xl p-8 flex items-center justify-center">
          <div className="w-full aspect-square rounded-2xl border border-slate-200 flex items-center justify-center">
            <img
              src="/logo512.png"
              alt="DropDrop Admin"
              className="w-4/5 h-auto opacity-90"
            />
          </div>
        </div>

        {/* Lado derecho: bienvenida admin */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-600 rounded-3xl shadow-xl p-8 text-white">
          <div className="mb-6">
            <h1 className="text-4xl md:text-5xl font-extrabold drop-shadow">
              ¡Bienvenido, Admin!
            </h1>
            <p className="mt-3 text-white/90">
              Accede al panel de productos y controla todos los países.
            </p>
          </div>

          <div className="bg-white/15 rounded-xl px-5 py-4 mb-5">
            <p className="text-white/90 text-sm">Correo verificado</p>
            <p className="text-lg font-semibold">{email ?? "—"}</p>
          </div>

          <div className="bg-white text-blue-900 rounded-xl px-5 py-4 mb-6">
            <p className="font-semibold text-lg">
              🚀 ¡Vamos a ser millonarios pronto!
            </p>
            <p className="text-sm text-blue-700/80">
              Mantén el foco: datos, decisiones y velocidad.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => navigate("/dashboard")}
              className="inline-flex items-center justify-center rounded-xl px-5 py-3 bg-white text-blue-700 font-semibold hover:bg-white/90 transition shadow"
            >
              Ir al Dashboard
            </button>
            <button
              onClick={() => navigate("/hot")}
              className="inline-flex items-center justify-center rounded-xl px-5 py-3 bg-blue-900/40 text-white font-semibold hover:bg-blue-900/50 transition border border-white/20"
            >
              Ver Productos Hot
            </button>
            <button
              onClick={() => navigate("/admin/payments")}
              className="inline-flex items-center justify-center rounded-xl px-5 py-3 bg-indigo-500 text-white font-semibold hover:bg-indigo-600 transition shadow"
            >
              Gestión de Pagos
            </button>
          </div>

          <p className="mt-6 text-xs text-white/70">
            Tip: esta vista es solo para administradores. Los usuarios normales
            verán el inicio con acceso a Chile.
          </p>
        </div>
      </div>
    </div>
  );
}
