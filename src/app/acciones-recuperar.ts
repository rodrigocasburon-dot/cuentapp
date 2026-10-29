"use server";

// Recuperación de contraseña (RFQ, requisito 1; D-57). Acciones PÚBLICAS: quien
// las usa no tiene sesión. Por eso no revelan si un email está registrado y
// tienen freno propio (por email y global).

import { redirect } from "next/navigation";
import { URL_PUBLICA } from "@/config";
import { NuevaContrasenaSchema, RecuperarSchema, erroresPorCampo, type EstadoFormulario } from "@/dominio/formularios-acceso";
import { cifrarContrasena } from "@/servidor/auth/contrasenas";
import { bd } from "@/servidor/bd/conexion";
import { crearRecuperacion, intentosRecientes, registrarIntentoFallido, usarRecuperacion, usuarioPorEmail } from "@/servidor/bd/cuentas";
import { enviarCorreo } from "@/servidor/correo/salida";

const MAX_POR_EMAIL = 3;   // en 15 minutos
const MAX_GLOBAL = 30;     // en 15 minutos (sin IP fiable en local, como en el registro)
const MAX_CAMBIOS = 20;    // intentos de usar enlaces en 15 minutos

/** Mismo mensaje exista o no la cuenta: no se puede usar para averiguar quién está registrado. */
const ENVIADO =
  "Si hay una cuenta con ese email, te hemos enviado un enlace para crear una contraseña nueva. Caduca en 30 minutos.";

export async function pedirRecuperacion(_previo: EstadoFormulario, f: FormData): Promise<EstadoFormulario> {
  const valores = { email: String(f.get("email") ?? "") };
  const datos = RecuperarSchema.safeParse(valores);
  if (!datos.success) return { errores: erroresPorCampo(datos.error), valores };
  const { email } = datos.data;

  const clave = `recuperar:${email}`;
  if (intentosRecientes(bd(), clave) >= MAX_POR_EMAIL || intentosRecientes(bd(), "recuperar:global") >= MAX_GLOBAL) {
    return { mensaje: "Has pedido demasiados enlaces. Espera 15 minutos y vuelve a probar.", valores };
  }
  registrarIntentoFallido(bd(), clave);
  registrarIntentoFallido(bd(), "recuperar:global");

  const usuario = usuarioPorEmail(bd(), email);
  if (usuario) {
    const token = crearRecuperacion(bd(), usuario.id);
    enviarCorreo({
      para: usuario.email,
      asunto: "Cuentapp · Crea una contraseña nueva",
      texto: [
        `Hola, ${usuario.nombre}:`,
        "",
        "Alguien (esperamos que tú) ha pedido cambiar la contraseña de tu cuenta de Cuentapp.",
        "Abre este enlace en los próximos 30 minutos para crear una nueva:",
        "",
        `${URL_PUBLICA}/recuperar/${token}`,
        "",
        "Si no lo has pedido tú, ignora este correo: tu contraseña no cambia.",
        "Al cambiarla se cierran todas las sesiones abiertas de tu cuenta.",
      ].join("\n"),
    });
  }
  return { hecho: ENVIADO };
}

export async function restablecerContrasena(token: string, _previo: EstadoFormulario, f: FormData): Promise<EstadoFormulario> {
  const datos = NuevaContrasenaSchema.safeParse({ contrasena: String(f.get("contrasena") ?? ""), repetir: String(f.get("repetir") ?? "") });
  if (!datos.success) return { errores: erroresPorCampo(datos.error) };

  // Cada intento cuesta un scrypt (~0,5 s de CPU): freno global
  if (intentosRecientes(bd(), "recuperar:cambio") >= MAX_CAMBIOS) {
    return { mensaje: "Demasiados intentos. Espera unos minutos y vuelve a probar." };
  }
  registrarIntentoFallido(bd(), "recuperar:cambio");

  const ok = usarRecuperacion(bd(), String(token), await cifrarContrasena(datos.data.contrasena));
  if (!ok) return { mensaje: "El enlace ya no vale: ha caducado o ya se ha usado. Pide uno nuevo." };
  redirect("/entrar?restablecida=1");
}
