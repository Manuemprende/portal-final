import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../services/supabaseClient"; // ajusta la ruta si tu cliente está en otro lado

type Member = {
  id: string | number;
  email: string;
  sales_delivered: number;
  subscription_status: string | null;
  plan: string | null;
  country_access: string[] | null;
  updated_at: string | null;
};

const MIN_SALES = 5;
const CL = "CL";

/** Base opcional para generar un checkout link. 
 *  Configúrala en tu .env => VITE_CHECKOUT_URL_BASE=https://tu-pago.com/checkout?plan=premium&email=
 */
const CHECKOUT_BASE = import.meta.env.VITE_CHECKOUT_URL_BASE ?? "";

export default function AdminUsers() {
  const [rows, setRows] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [busyIds, setBusyIds] = useState<Set<string | number>>(new Set());
  const [toast, setToast] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) => r.email?.toLowerCase().includes(term));
  }, [q, rows]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("members")
        .select("id,email,sales_delivered,subscription_status,plan,country_access,updated_at")
        .gte("sales_delivered", MIN_SALES)
        .order("sales_delivered", { ascending: false });

      if (error) {
        console.error(error);
        setToast("No pude cargar usuarios. Revisa RLS/tabla.");
      } else {
        setRows((data as Member[]) ?? []);
      }
      setLoading(false);
    })();
  }, []);

  function markBusy(id: string | number, v: boolean) {
    setBusyIds((prev) => {
      const x = new Set(prev);
      if (v) x.add(id);
      else x.delete(id);
      return x;
    });
  }

  async function grantChile(m: Member) {
    markBusy(m.id, true);
    try {
      const current = Array.isArray(m.country_access) ? m.country_access : [];
      if (current.includes(CL)) {
        setToast("Ese usuario ya tiene acceso a Chile.");
        return;
      }
      const next = [...current, CL];
      const { error } = await supabase
        .from("members")
        .update({ country_access: next, updated_at: new Date().toISOString() })
        .eq("id", m.id);

      if (error) throw error;

      setRows((prev) =>
        prev.map((r) => (r.id === m.id ? { ...r, country_access: next } : r))
      );
      setToast("Acceso a Chile concedido ✅");
    } catch (e: any) {
      console.error(e);
      setToast("No se pudo conceder acceso.");
    } finally {
      markBusy(m.id, false);
    }
  }

  function genCheckoutLink(email: string) {
    if (!CHECKOUT_BASE) {
      setToast("Configura VITE_CHECKOUT_URL_BASE en tu .env para generar links.");
      return;
    }
    const url = `${CHECKOUT_BASE}${encodeURIComponent(email)}`;
    navigator.clipboard
      .writeText(url)
      .then(() => setToast("Enlace de pago copiado al portapapeles ✅"))
      .catch(() => window.open(url, "_blank"));
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Usuarios con 5+ ventas</h1>
            <p className="text-slate-600">Habilita acceso a Chile y gestiona suscripciones.</p>
          </div>
          <a
            href="/admin"
            className="rounded-xl bg-white px-4 py-2 text-slate-700 border border-slate-200 shadow hover:bg-slate-50"
          >
            ← Volver a Admin
          </a>
        </header>

        <div className="mb-4 flex items-center gap-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por correo…"
            className="w-full md:w-96 rounded-xl border border-slate-300 bg-white px-4 py-2 outline-none focus:ring-2 focus:ring-sky-400"
          />
          <span className="text-sm text-slate-500">
            {filtered.length} de {rows.length}
          </span>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full table-fixed">
            <thead className="bg-slate-50 text-left text-slate-600 text-sm">
              <tr>
                <th className="px-4 py-3 w-[36%]">Email</th>
                <th className="px-2 py-3 w-[10%]">Ventas</th>
                <th className="px-2 py-3 w-[18%]">Suscripción</th>
                <th className="px-2 py-3 w-[18%]">Países habilitados</th>
                <th className="px-4 py-3 w-[18%]">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                    Cargando usuarios…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                    Sin resultados.
                  </td>
                </tr>
              ) : (
                filtered.map((m) => {
                  const hasCL = (m.country_access ?? []).includes(CL);
                  const busy = busyIds.has(m.id);
                  return (
                    <tr key={m.id} className="text-sm">
                      <td className="px-4 py-3 font-medium text-slate-800">{m.email}</td>
                      <td className="px-2 py-3">{m.sales_delivered}</td>
                      <td className="px-2 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 font-medium ${
                            m.subscription_status === "active"
                              ? "bg-green-100 text-green-700"
                              : m.subscription_status === "trialing"
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {m.subscription_status ?? "sin suscripción"}
                        </span>
                      </td>
                      <td className="px-2 py-3">
                        {(m.country_access ?? []).length > 0 ? (
                          <span className="text-slate-700">
                            {(m.country_access ?? []).join(", ")}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            disabled={busy || hasCL}
                            onClick={() => grantChile(m)}
                            className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                              busy || hasCL
                                ? "bg-slate-200 text-slate-500 cursor-not-allowed"
                                : "bg-sky-600 text-white hover:bg-sky-700"
                            }`}
                          >
                            {hasCL ? "Chile habilitado" : "Habilitar Chile"}
                          </button>
                          <button
                            onClick={() => genCheckoutLink(m.email)}
                            className="rounded-xl px-3 py-2 text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700"
                          >
                            Generar enlace de pago
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {toast && (
          <div className="fixed bottom-6 right-6 rounded-xl bg-slate-900 text-white px-4 py-3 shadow-lg"
               onAnimationEnd={() => setToast(null)}>
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}
