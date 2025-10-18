// supabase/functions/mp-webhook/index.ts
// Supabase Edge Function (Deno) - Webhook Mercado Pago
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const MP_ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

function json(status: number, data: unknown) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

async function getPayment(id: string) {
  const url = `https://api.mercadopago.com/v1/payments/${id}`;
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
  });
  if (!r.ok) throw new Error(`MP get payment failed ${r.status}: ${await r.text()}`);
  return await r.json();
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST" && req.method !== "GET") {
      return json(405, { error: "Method Not Allowed" });
    }
    if (!MP_ACCESS_TOKEN) return json(500, { error: "Falta MP_ACCESS_TOKEN" });
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return json(500, { error: "Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY" });
    }

    // MP a veces envía id/topic por query, otras en el body.
    const url = new URL(req.url);
    const qId = url.searchParams.get("id");
    const qType = url.searchParams.get("type") || url.searchParams.get("topic");

    let body: any = {};
    try { body = await req.json(); } catch { /* ignore */ }

    const bodyId = body?.data?.id || body?.id;
    const bodyType = body?.type || body?.topic || body?.action;

    const paymentId = (qType === "payment" && qId) ? qId : (bodyType === "payment" ? bodyId : qId || bodyId);
    if (!paymentId) return json(200, { ok: true, msg: "No payment id, ignoring" });

    // Traer pago desde MP
    const payment = await getPayment(String(paymentId));
    const status = payment?.status;
    const metadata = payment?.metadata ?? {};
    // Esperamos estos datos desde la preferencia
    const email: string = metadata.email;
    const countries: string[] = metadata.countries;
    const months: number = Number(metadata.months);
    const amount_cents: number = Number(metadata.amount_cents);
    const note: string | null = metadata.note ?? null;

    // Log de seguridad mínimo
    console.log("MP payment:", { paymentId, status, email, countries, months, amount_cents });

    if (status !== "approved") {
      return json(200, { ok: true, msg: "Pago no aprobado, sin acción" });
    }
    if (!email || !Array.isArray(countries) || !months || !amount_cents) {
      return json(400, { error: "Metadata incompleta en el pago aprobado" });
    }

    // Llamar RPC para activar acceso
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const { data, error } = await supabase.rpc("grant_access_with_payment", {
      p_email: email,
      p_method: "MERCADO_PAGO",
      p_amount_cents: amount_cents,
      p_countries: countries,
      p_months: months,
      p_note: note ?? `mp_payment_${paymentId}`,
    });

    if (error) {
      console.error("RPC error:", error);
      return json(500, { error: "RPC grant_access_with_payment falló", detail: error });
    }

    return json(200, { ok: true, updated: data });
  } catch (e: any) {
    console.error(e);
    return json(500, { error: e?.message || "Webhook error" });
  }
});
