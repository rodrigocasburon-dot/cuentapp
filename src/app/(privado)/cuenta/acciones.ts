"use server";

// «Mi cuenta»: cambiar los datos de la empresa y del usuario, y darse de baja (D-42).
// La empresa y el usuario salen SIEMPRE de la sesión, nunca del formulario.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { CUENTAS_DEMO, URL_PUBLICA } from "@/config";
import { DatosCuentaSchema, erroresPorCampo, type EstadoFormulario } from "@/dominio/formularios-acceso";
import { cerrarSesion, repositorioActual } from "@/servidor/auth/sesion";
import { bd } from "@/servidor/bd/conexion";
import { cambiarNombreUsuario, darDeBaja } from "@/servidor/bd/cuentas";
import { cancelarSuscripcion, crearPagoPlan, stripeActivo } from "@/servidor/pagos/stripe";

const texto = (f: FormData, campo: string) => String(f.get(campo) ?? "");

export async function guardarDatosCuenta(_previo: EstadoFormulario, f: FormData): Promise<EstadoFormulario> {
  const { repo, sesion } = await repositorioActual();
  const valores = { empresa: texto(f, "empresa"), nif: texto(f, "nif"), nombre: texto(f, "nombre") };
  const datos = DatosCuentaSchema.safeParse(valores);
  if (!datos.success) return { errores: erroresPorCampo(datos.error), valores };

  repo.cambiarDatosEmpresa(datos.data.empresa, datos.data.nif);
  cambiarNombreUsuario(bd(), sesion.usuario.id, datos.data.nombre);
  revalidatePath("/", "layout"); // el nombre aparece en la cabecera de todas las páginas
  return { hecho: "Datos guardados.", valores: { ...valores, nif: datos.data.nif ?? "" } };
}

/**
 * Cambio de plan. Con Stripe de pruebas configurado (D-60), lleva a la página
 * de pago de Stripe y el plan se activa al volver, cuando el servidor ha
 * comprobado el pago (/cuenta/pago). Sin Stripe, cambio simulado sin cobro (D-47).
 */
export async function activarPlanAction(planId: string): Promise<void> {
  const { repo } = await repositorioActual();
  if (!stripeActivo()) {
    repo.cambiarPlan(planId);
    revalidatePath("/", "layout");
    redirect("/cuenta?plan=1");
  }

  const plan = repo.planContratable(planId);
  if (!plan) redirect("/cuenta");
  let url: string | null;
  try {
    ({ url } = await crearPagoPlan({
      empresaId: repo.empresaId,
      plan,
      urlVuelta: `${URL_PUBLICA}/cuenta/pago?session_id={CHECKOUT_SESSION_ID}`,
      urlCancelar: `${URL_PUBLICA}/cuenta?pago=cancelado`,
    }));
  } catch (e) {
    console.error(e);
    url = null;
  }
  redirect(url ?? "/cuenta?pago=error"); // fuera del try: redirect() lanza una excepción
}

/** Cancela en Stripe las suscripciones de la empresa (al darse de baja). Si falla, se avisa en la consola. */
async function cancelarSuscripciones(repo: Awaited<ReturnType<typeof repositorioActual>>["repo"]): Promise<void> {
  if (!stripeActivo()) return;
  for (const s of repo.suscripcionesActivas()) {
    try {
      await cancelarSuscripcion(s);
      repo.marcarSuscripcionCancelada(s);
    } catch (e) {
      console.error(`[stripe] No se ha podido cancelar ${s}:`, e);
    }
  }
}

export async function darmeDeBaja(_previo: EstadoFormulario, f: FormData): Promise<EstadoFormulario> {
  const { sesion, repo } = await repositorioActual();
  if (f.get("confirmo") !== "si") return { errores: { confirmo: "Marca la casilla para confirmar la baja." } };
  if (CUENTAS_DEMO.some((c) => c.email === sesion.usuario.email)) {
    return { mensaje: "Las cuentas de demostración no se pueden dar de baja: las usa todo el equipo." };
  }
  try {
    darDeBaja(bd(), sesion.usuario.id, sesion.empresa.id);
    await cancelarSuscripciones(repo); // tras la baja: si la baja falla, se sigue cobrando
  } catch (e) {
    console.error(e);
    return { mensaje: "No se ha podido dar de baja la cuenta. Solo puede hacerlo el titular." };
  }
  await cerrarSesion();
  redirect("/entrar?baja=1");
}
