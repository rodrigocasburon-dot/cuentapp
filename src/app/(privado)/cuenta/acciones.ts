"use server";

// «Mi cuenta»: cambiar los datos de la empresa y del usuario, y darse de baja (D-42).
// La empresa y el usuario salen SIEMPRE de la sesión, nunca del formulario.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { CUENTAS_DEMO } from "@/config";
import { DatosCuentaSchema, erroresPorCampo, type EstadoFormulario } from "@/dominio/formularios-acceso";
import { cerrarSesion, repositorioActual } from "@/servidor/auth/sesion";
import { bd } from "@/servidor/bd/conexion";
import { cambiarNombreUsuario, darDeBaja } from "@/servidor/bd/cuentas";

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

/** Cambio de plan simulado (fase 9): en esta versión no hay cobro real. */
export async function activarPlanAction(planId: string): Promise<void> {
  const { repo } = await repositorioActual();
  repo.cambiarPlan(planId);
  revalidatePath("/", "layout");
  redirect("/cuenta?plan=1");
}

export async function darmeDeBaja(_previo: EstadoFormulario, f: FormData): Promise<EstadoFormulario> {
  const { sesion } = await repositorioActual();
  if (f.get("confirmo") !== "si") return { errores: { confirmo: "Marca la casilla para confirmar la baja." } };
  if (CUENTAS_DEMO.some((c) => c.email === sesion.usuario.email)) {
    return { mensaje: "Las cuentas de demostración no se pueden dar de baja: las usa todo el equipo." };
  }
  try {
    darDeBaja(bd(), sesion.usuario.id, sesion.empresa.id);
  } catch (e) {
    return { mensaje: e instanceof Error ? e.message : "No se ha podido dar de baja la cuenta." };
  }
  await cerrarSesion();
  redirect("/entrar?baja=1");
}
