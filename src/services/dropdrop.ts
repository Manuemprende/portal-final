// src/services/dropdrop.ts
export const API_BASE = "https://app.dropdrop.net/api/v1";
export const API_KEY = "secret-dev-key";

/** 🔹 Obtener usuario por correo */
export async function getUsuario(email: string) {
  const res = await fetch(`${API_BASE}/usuarios?email=${email}`, {
    headers: {
      "X-API-Key": API_KEY,
      Accept: "application/json",
    },
  });
  const data = await res.json();
  return data?.data?.items?.[0] || null;
}

/** 🔹 Obtener pedidos por rango de fechas */
export async function getPedidos(start: string, end: string) {
  const res = await fetch(
    `${API_BASE}/pedidos?start_date=${start}&end_date=${end}&per_page=500&page=1`,
    {
      headers: {
        "X-API-Key": API_KEY,
        Accept: "application/json",
      },
    }
  );
  const data = await res.json();
  return data?.data?.items ?? [];
}

/** 🔹 Verificar entregas del usuario actual */
export async function verificarUsuarioPorPedidos(email: string) {
  try {
    // Fecha de inicio y fin del mes actual
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate()
      ).padStart(2, "0")}`;

    const usuario = await getUsuario(email);
    if (!usuario) return { autorizado: false, ventas: 0, usuario: null };

    const pedidos = await getPedidos(fmt(start), fmt(end));
    const entregados = pedidos.filter(
      (p: any) =>
        (p.email === email ||
          p.nombreNegocioTienda === usuario.nombreNegocio ||
          p.id_usuario === usuario.id) &&
        (p.trackindPedido?.toLowerCase() === "entregado" ||
          p.estado?.toLowerCase() === "entregado")
    );

    return {
      autorizado: entregados.length >= 5,
      ventas: entregados.length,
      usuario,
    };
  } catch (err) {
    console.error("Error al verificar usuario:", err);
    return { autorizado: false, ventas: 0, usuario: null };
  }
}
