// Cobro de los planes con Stripe en MODO DE PRUEBAS (D-60).
//
// Se usa la API REST de Stripe con fetch (sin dependencias nuevas). Solo se
// admiten claves de prueba (sk_test_…): con ellas no se mueve dinero y se paga
// con tarjetas de prueba como 4242 4242 4242 4242. Sin clave, la app sigue con
// el cambio de plan sin cobro (D-47).
//
// La clave va en .env.local (fuera de git), nunca en el código. Este módulo
// solo se usa en el servidor (los componentes cliente no pueden importar
// @/servidor: lo vigila una prueba estática).

export const IVA_GENERAL = 21; // % aplicado al precio del plan (supuesto, D-60)

/** Precio con IVA, en céntimos: 2000 → 2420. */
export function conIva(centimos: number): number {
  return Math.round((centimos * (100 + IVA_GENERAL)) / 100);
}

/**
 * Clave de Stripe válida para esta app: SOLO de pruebas. Una clave real
 * (sk_live_…) se rechaza para que nadie cobre de verdad por error.
 */
export function claveStripe(entorno: Record<string, string | undefined> = process.env): string | null {
  const clave = entorno.STRIPE_SECRET_KEY?.trim();
  if (!clave) return null;
  if (!clave.startsWith("sk_test_")) {
    console.error("[stripe] STRIPE_SECRET_KEY no es de pruebas (sk_test_…): se ignora y no se cobra nada.");
    return null;
  }
  return clave;
}

export const stripeActivo = () => claveStripe() !== null;

type Fetch = typeof fetch;
type Parametros = Record<string, string | number>;

async function llamar<T>(metodo: "GET" | "POST" | "DELETE", ruta: string, parametros: Parametros = {}, f: Fetch = fetch): Promise<T> {
  const clave = claveStripe();
  if (!clave) throw new Error("Stripe no está configurado");
  const cuerpo = new URLSearchParams(Object.entries(parametros).map(([k, v]) => [k, String(v)]));
  const respuesta = await f(`https://api.stripe.com/v1/${ruta}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${clave}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: metodo === "POST" ? cuerpo : undefined,
    cache: "no-store",
  });
  const datos = (await respuesta.json()) as T & { error?: { message?: string } };
  if (!respuesta.ok) throw new Error(`Stripe ${respuesta.status}: ${datos.error?.message ?? "error desconocido"}`);
  return datos;
}

export interface SesionPago {
  id: string;
  url: string | null;
  status: string | null;          // "complete" cuando el cliente ha terminado
  payment_status: string | null;  // "paid" cuando se ha cobrado
  client_reference_id: string | null;
  metadata: Record<string, string> | null;
  subscription: string | null;
  amount_total: number | null;
  currency: string | null;
}

/**
 * Crea la página de pago (Checkout) de una suscripción mensual al plan. No se
 * envía el email ni el nombre del usuario: Stripe los pide en su página.
 */
export function crearPagoPlan(
  d: { empresaId: string; plan: { id: string; nombre: string; precio_centimos: number }; urlVuelta: string; urlCancelar: string },
  f: Fetch = fetch,
): Promise<SesionPago> {
  return llamar<SesionPago>(
    "POST",
    "checkout/sessions",
    {
      mode: "subscription",
      client_reference_id: d.empresaId,
      "metadata[empresa_id]": d.empresaId,
      "metadata[plan_id]": d.plan.id,
      "line_items[0][quantity]": 1,
      "line_items[0][price_data][currency]": "eur",
      "line_items[0][price_data][unit_amount]": conIva(d.plan.precio_centimos),
      "line_items[0][price_data][recurring][interval]": "month",
      "line_items[0][price_data][product_data][name]": `${d.plan.nombre} (IVA ${IVA_GENERAL} % incluido)`,
      success_url: d.urlVuelta,
      cancel_url: d.urlCancelar,
      locale: "es",
    },
    f,
  );
}

export async function leerPago(sesionId: string, f: Fetch = fetch): Promise<SesionPago> {
  if (!/^cs_test_[A-Za-z0-9]+$/.test(sesionId)) throw new Error("Sesión de pago no válida");
  return llamar<SesionPago>("GET", `checkout/sessions/${sesionId}`, {}, f);
}

/** Cancela una suscripción al momento (al cambiar de plan o darse de baja). */
export async function cancelarSuscripcion(suscripcionId: string, f: Fetch = fetch): Promise<void> {
  if (!/^sub_[A-Za-z0-9]+$/.test(suscripcionId)) throw new Error("Suscripción no válida");
  await llamar("DELETE", `subscriptions/${suscripcionId}`, {}, f);
}

/**
 * ¿Este pago, leído de Stripe, activa este plan para esta empresa? Se comprueba
 * todo lo que viene del navegador: que sea de esta empresa, que esté pagado y
 * que el plan y el importe sean los esperados.
 */
export function pagoValido(
  s: SesionPago,
  empresaId: string,
  plan: { id: string; precio_centimos: number } | undefined,
): boolean {
  return (
    !!plan &&
    s.client_reference_id === empresaId &&
    s.metadata?.empresa_id === empresaId &&
    s.metadata?.plan_id === plan.id &&
    s.status === "complete" &&
    s.payment_status === "paid" &&
    s.currency === "eur" &&
    s.amount_total === conIva(plan.precio_centimos)
  );
}
