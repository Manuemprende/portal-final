export async function verificarUsuarioPorPedidos(email: string) {
  const API_KEY = "secret-dev-key";
  const API_BASE = "https://app.dropdrop.net/api/v1";

  try {
    // 1️⃣ Buscar usuario por email
    const userRes = await fetch(`${API_BASE}/usuarios?email=${email}`, {
      headers: {
        "X-API-Key": API_KEY,
        "Accept": "application/json",
      },
    });

    if (!userRes.ok) throw new Error("Error al consultar usuarios");
    const userData = await userRes.json();

    const usuario = userData?.data?.items?.[0];
    if (!usuario) {
      return { autorizado: false, error: "Usuario no encontrado" };
    }

    const userId = usuario.id;

    // 2️⃣ Buscar pedidos (por rango de fechas amplio)
    const today = new Date();
    const start = "2025-08-01"; // puedes ajustar el rango a 30 días atrás
    const end = today.toISOString().split("T")[0];

    const pedidosRes = await fetch(
      `${API_BASE}/pedidos?start_date=${start}&end_date=${end}&per_page=100&page=1`,
      {
        headers: {
          "X-API-Key": API_KEY,
          "Accept": "application/json",
        },
      }
    );

    if (!pedidosRes.ok) throw new Error("Error al consultar pedidos");
    const pedidosData = await pedidosRes.json();

    const pedidos = pedidosData?.data?.items ?? [];

    // 3️⃣ Filtrar pedidos del usuario que estén entregados
    const pedidosUsuario = pedidos.filter(
      (p: any) =>
        (p.email === email || p.id_usuario === userId) &&
        p.estado?.toLowerCase() === "entregado"
    );

    const entregados = pedidosUsuario.length;

    // 4️⃣ Validar si puede acceder
    if (entregados >= 5) {
      return { autorizado: true, ventas: entregados, usuario };
    } else {
      return { autorizado: false, ventas: entregados };
    }
  } catch (err) {
    console.error("❌ Error DropDrop Auth:", err);
    return { autorizado: false, error: "Error al verificar usuario" };
  }
}
