// Sesión del usuario en Next.js: cookie + base de datos.
//
// PUERTA DE ENTRADA A LOS DATOS: las páginas y acciones obtienen el
// repositorio SOLO con repositorioActual(). Así la empresa siempre sale de la
// sesión verificada, nunca de un parámetro que pueda manipular el navegador.
// Comprobar la sesión en el layout no basta: las Server Actions se pueden
// llamar directamente, por eso la comprobación vive aquí, junto a los datos.

import "server-only"; // error de compilación si alguien lo importa desde el navegador
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { bd } from "@/servidor/bd/conexion";
import { borrarSesion, crearSesion, leerSesion, type Sesion } from "@/servidor/bd/cuentas";
import { repositorioDeEmpresa } from "@/servidor/bd/repositorio";

const COOKIE = "cuentapp_sesion";

export async function abrirSesion(usuarioId: string, empresaId: string): Promise<void> {
  const { token, expira } = crearSesion(bd(), usuarioId, empresaId);
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,                                  // JavaScript del navegador no la puede leer
    sameSite: "lax",                                 // no viaja en peticiones POST de otras webs
    secure: process.env.NODE_ENV === "production",   // solo HTTPS en producción
    path: "/",
    expires: expira,
  });
}

export async function sesionActual(): Promise<Sesion | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  return token ? leerSesion(bd(), token) : null;
}

/** Devuelve la sesión o manda a /entrar. */
export async function exigirSesion(): Promise<Sesion> {
  const sesion = await sesionActual();
  if (!sesion) redirect("/entrar");
  return sesion;
}

/** Sesión verificada + repositorio de SU empresa. */
export async function repositorioActual() {
  const sesion = await exigirSesion();
  return { sesion, repo: repositorioDeEmpresa(bd(), sesion.empresa.id) };
}

export async function cerrarSesion(): Promise<void> {
  const almacen = await cookies();
  const token = almacen.get(COOKIE)?.value;
  if (token) borrarSesion(bd(), token);
  almacen.delete(COOKIE);
}
