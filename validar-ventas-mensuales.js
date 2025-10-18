// validar-ventas-mensuales.js
import fetch from "node-fetch";

// Config
const API_KEY = "secret-dev-key";
const API_BASE = "https://app.dropdrop.net/api/v1";
const EMAIL = process.argv[2] || "ecodealsstore@gmail.com"; // puedes pasar otro correo como argumento

// Función auxiliar para obtener rango de fechas del mes actual
function getCurrentMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const toYMD = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
  return { start: toYMD(start), end: toYMD(end) };
}

async function main() {
  try {
    const { start, end } = getCurrentMonthRange();
    console.log(`📅 Validando entregas desde ${start} hasta ${end}...\n`);

    // 1️⃣ Buscar usuario
    const userRes = await fetch(`${API_BASE}/usuarios?email=${EMAIL}`, {
      headers: { "X-API-Key": API_KEY, Accept: "application/json" },
    });
    const userData = await userRes.json();
    const usuario = userData.data.items[0];
    if (!usuario) {
      console.log("❌ Usuario no encontrado");
      return;
    }

    console.log(`👤 Usuario: ${usuario.nombresApellidos} (${usuario.nombreNegocio})`);

    // 2️⃣ Buscar pedidos del mes
    const pedidosRes = await fetch(
      `${API_BASE}/pedidos?start_date=${start}&end_date=${end}&per_page=500&page=1`,
      { headers: { "X-API-Key": API_KEY, Accept: "application/json" } }
    );
    const pedidosData = await pedidosRes.json();
    const pedidos = pedidosData.data.items ?? [];

    // 3️⃣ Filtrar los del usuario y entregados
    const entregados = pedidos.filter(
      (p) =>
        (p.nombreNegocioTienda === usuario.nombreNegocio ||
          p.email === EMAIL ||
          p.id_usuario === usuario.id) &&
        (p.trackindPedido?.toLowerCase() === "entregado" ||
          p.estado?.toLowerCase() === "entregado")
    );

    // 4️⃣ Mostrar resultado
    console.log(`📦 Ventas entregadas este mes: ${entregados.length}`);
    entregados.forEach((p) =>
      console.log(`   🆔 Pedido #${p.id} | Fecha: ${p.fechaEmision}`)
    );

    // 5️⃣ Validación automática
    if (entregados.length >= 5) {
      console.log("\n✅ ACCESO HABILITADO: el usuario superó las 5 entregas mensuales.");
      process.exitCode = 0;
    } else {
      console.log(
        `\n🚫 ACCESO BLOQUEADO: solo ${entregados.length} entregas. Faltan ${
          5 - entregados.length
        } para habilitar.`
      );
      process.exitCode = 1;
    }
  } catch (err) {
    console.error("❌ Error:", err.message);
  }
}

main();
