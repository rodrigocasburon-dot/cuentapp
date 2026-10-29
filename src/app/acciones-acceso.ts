"use server";

// Acciones de servidor de registro, entrada y salida (RF-01).

import { redirect } from "next/navigation";
import { ACCESO_DEMO, CUENTAS_DEMO } from "@/config";
import { EntradaSchema, RegistroSchema, erroresPorCampo, type EstadoFormulario } from "@/dominio/formularios-acceso";
import { cifrarContrasena, hashParaIgualarTiempos, verificarContrasena } from "@/servidor/auth/contrasenas";
import { abrirSesion, cerrarSesion } from "@/servidor/auth/sesion";
import { bd } from "@/servidor/bd/conexion";
import {
  EmailEnUso,
  MAX_INTENTOS,
  buscarCredenciales,
  crearEmpresaConTitular,
  empresasDeUsuario,
  intentosRecientes,
  olvidarIntentos,
  registrarIntentoFallido,
} from "@/servidor/bd/cuentas";

const texto = (f: FormData, campo: string) => String(f.get(campo) ?? "");

export async function registrar(_previo: EstadoFormulario, f: FormData): Promise<EstadoFormulario> {
  const valores = { empresa: texto(f, "empresa"), nif: texto(f, "nif"), nombre: texto(f, "nombre"), email: texto(f, "email") };
  const datos = RegistroSchema.safeParse({ ...valores, contrasena: texto(f, "contrasena") });
  const errores: Record<string, string> = datos.success ? {} : erroresPorCampo(datos.error);
  if (texto(f, "acepto") !== "si") errores.acepto = "Para crear la cuenta tienes que aceptar los términos y la política de privacidad.";
  if (!datos.success || errores.acepto) return { errores, valores };

  let usuarioId: string, empresaId: string;
  try {
    ({ usuarioId, empresaId } = crearEmpresaConTitular(bd(), {
      empresa: datos.data.empresa,
      nif: datos.data.nif,
      nombre: datos.data.nombre,
      email: datos.data.email,
      hashContrasena: await cifrarContrasena(datos.data.contrasena),
    }));
  } catch (e) {
    if (e instanceof EmailEnUso) return { errores: { email: "Ya hay una cuenta con ese email. ¿Quieres entrar?" }, valores };
    throw e;
  }
  await abrirSesion(usuarioId, empresaId);
  redirect("/panel"); // fuera del try: redirect() funciona lanzando una excepción
}

export async function entrar(_previo: EstadoFormulario, f: FormData): Promise<EstadoFormulario> {
  const valores = { email: texto(f, "email") };
  const datos = EntradaSchema.safeParse({ ...valores, contrasena: texto(f, "contrasena") });
  if (!datos.success) return { errores: erroresPorCampo(datos.error), valores };
  const { email, contrasena } = datos.data;

  if (intentosRecientes(bd(), email) >= MAX_INTENTOS) {
    return { mensaje: "Demasiados intentos fallidos. Espera 15 minutos y vuelve a probar.", valores };
  }

  const usuario = buscarCredenciales(bd(), email);
  // Se verifica siempre (con un hash ficticio si el email no existe) para tardar lo mismo
  const correcta = await verificarContrasena(contrasena, usuario?.hash_contrasena ?? (await hashParaIgualarTiempos()));
  const empresa = usuario && correcta ? empresasDeUsuario(bd(), usuario.id)[0] : undefined;
  if (!usuario || !correcta || !empresa) {
    registrarIntentoFallido(bd(), email);
    // Mismo mensaje en todos los casos: no revelamos si el email existe
    return { mensaje: "El email o la contraseña no son correctos.", valores };
  }

  olvidarIntentos(bd(), email);
  await abrirSesion(usuario.id, empresa.id);
  redirect("/panel");
}

/**
 * Acceso de demostración (solo local + desarrollo, ver ACCESO_DEMO): entra sin
 * contraseña, pero ÚNICAMENTE con las cuentas de prueba de la lista. La
 * sesión es una sesión normal, así que el aislamiento entre empresas no cambia.
 */
export async function entrarDemo(f: FormData): Promise<void> {
  if (!ACCESO_DEMO) throw new Error("El acceso de demostración está desactivado.");
  const email = texto(f, "email");
  if (!CUENTAS_DEMO.some((c) => c.email === email)) throw new Error("Cuenta de demostración desconocida.");
  const usuario = buscarCredenciales(bd(), email);
  const empresa = usuario ? empresasDeUsuario(bd(), usuario.id)[0] : undefined;
  if (!usuario || !empresa) throw new Error("No existe la cuenta de prueba. Ejecuta npm run db:reset.");
  await abrirSesion(usuario.id, empresa.id);
  redirect("/panel");
}

export async function salir(): Promise<void> {
  await cerrarSesion();
  redirect("/entrar");
}
