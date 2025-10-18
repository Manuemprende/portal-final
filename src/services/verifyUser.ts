// src/services/verifyUser.ts
export async function verificarUsuarioPorPedidos(email: string) {
  const API_KEY = import.meta.env.VITE_DROP_API_KEY || "secret-dev-key";
  const API_BASE = "https://app.dropdrop.net/api/v1";

  try {
    // Paso 1 — Buscar usuario por correo
    const userRes = await fetch(`${API_BASE}/usuarios?email=${email}`, {
      headers: { "X-API-Key": API_KEY, Accept: "application/json" },
    });

    if (!userRes.ok) throw new Error("Error consultando usuarios");
    const userData = await userRes.json();
    const usuario = userData?.data?.items?.[0];

    if (!usuario)
      return { autorizado: false, ventas: 0, motivo: "Usuario no encontrado" };

    const userId = usuario.id;
    const start = "2025-08-01";
    const end = new Date().toISOString().split("T")[0];

    // Paso 2 — Buscar pedidos recientes
    const pedidosRes = await fetch(
      `${API_BASE}/pedidos?start_date=${start}&end_date=${end}&per_page=200&page=1`,
      {
        headers: { "X-API-Key": API_KEY, Accept: "application/json" },
      }
    );

    if (!pedidosRes.ok) throw new Error("Error consultando pedidos");
    const pedidosData = await pedidosRes.json();
    const pedidos = pedidosData?.data?.items ?? [];

    // Paso 3 — Contar entregados del usuario
    const entregados = pedidos.filter(
      (p: any) =>
        (p.email === email || p.id_usuario === userId) &&
        (p.estado?.toLowerCase() === "entregado" ||
          p.status?.toLowerCase() === "entregado")
    ).length;

    return { autorizado: entregados >= 5, ventas: entregados, usuario };
  } catch (err) {
    console.error("❌ Error validando usuario:", err);
    return { autorizado: false, ventas: 0, motivo: "Error interno" };
  }
}
