// Vuelta de la página de pago de Stripe (D-60). Stripe redirige aquí con
// ?session_id=cs_test_…. NO nos fiamos de esa dirección: se pide la sesión a
// Stripe con la clave secreta y solo si es de esta empresa, está pagada y
// coincide plan e importe, se activa el plan. Registrar dos veces la misma
// sesión no hace nada (stripe_sesion es UNIQUE).

import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { repositorioActual } from "@/servidor/auth/sesion";
import { cancelarSuscripcion, leerPago, pagoValido, stripeActivo } from "@/servidor/pagos/stripe";

const volver = (req: NextRequest, consulta: string) => NextResponse.redirect(new URL(`/cuenta?${consulta}`, req.url), 303);

export async function GET(req: NextRequest) {
  const { repo } = await repositorioActual(); // sin sesión, a /entrar
  const sesionId = req.nextUrl.searchParams.get("session_id") ?? "";
  if (!stripeActivo()) return volver(req, "pago=error");

  let pago;
  try {
    pago = await leerPago(sesionId);
  } catch (e) {
    console.error(e);
    return volver(req, "pago=error");
  }
  const plan = repo.planContratable(pago.metadata?.plan_id ?? "");
  if (!pagoValido(pago, repo.empresaId, plan)) return volver(req, "pago=error");

  const nuevo = repo.registrarPago({
    planId: plan!.id,
    stripeSesion: pago.id,
    stripeSuscripcion: pago.subscription,
    importeCentimos: pago.amount_total!,
    moneda: pago.currency!,
  });

  // Al cambiar de plan, la suscripción anterior se cancela (sin prorrateo, D-60)
  if (nuevo) {
    for (const s of repo.suscripcionesActivas(pago.subscription)) {
      try {
        await cancelarSuscripcion(s);
        repo.marcarSuscripcionCancelada(s);
      } catch (e) {
        console.error(`[stripe] No se ha podido cancelar ${s}:`, e);
      }
    }
  }
  revalidatePath("/", "layout");
  return volver(req, "plan=1");
}
