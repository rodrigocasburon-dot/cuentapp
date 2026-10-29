// Reglas de los formularios de registro y entrada (mensajes en español).
// Se usan en el servidor; nunca te fíes solo de la validación del navegador.

import { z } from "zod";
import { nifValido, normalizarNif } from "./nif";

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Escribe un email válido." }));

export const RegistroSchema = z.object({
  empresa: z.string().trim().min(2, { error: "Escribe el nombre de la empresa." }).max(120, { error: "Máximo 120 caracteres." }),
  nif: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : normalizarNif(v)))
    .refine((v) => v === null || nifValido(v), { error: "El NIF/CIF no es válido. Revisa la letra o el dígito de control." }),
  nombre: z.string().trim().min(2, { error: "Escribe tu nombre." }).max(80, { error: "Máximo 80 caracteres." }),
  email,
  contrasena: z
    .string()
    .min(10, { error: "La contraseña debe tener al menos 10 caracteres." })
    .max(200, { error: "Máximo 200 caracteres." }),
});

/** «Mi cuenta»: mismas reglas que el registro para nombre de empresa, NIF y nombre. */
export const DatosCuentaSchema = RegistroSchema.pick({ empresa: true, nif: true, nombre: true });

/** Recuperación de contraseña: primero el email, luego la nueva contraseña dos veces. */
export const RecuperarSchema = z.object({ email });
export const NuevaContrasenaSchema = z
  .object({ contrasena: RegistroSchema.shape.contrasena, repetir: z.string() })
  .refine((d) => d.contrasena === d.repetir, { error: "Las dos contraseñas no coinciden.", path: ["repetir"] });

export const EntradaSchema = z.object({
  email,
  contrasena: z.string().min(1, { error: "Escribe tu contraseña." }).max(200),
});

/** Estado que devuelven las acciones de formulario a la página. */
export interface EstadoFormulario {
  errores?: Record<string, string>;   // por campo
  mensaje?: string;                    // error general
  hecho?: string;                      // confirmación (p. ej. «Datos guardados»)
  valores?: Record<string, string>;    // lo que escribió el usuario (nunca la contraseña)
}

/** Primer error de cada campo, en el formato de EstadoFormulario. */
export function erroresPorCampo(error: z.ZodError): Record<string, string> {
  const errores: Record<string, string> = {};
  for (const i of error.issues) {
    const campo = String(i.path[0] ?? "general");
    errores[campo] ??= i.message;
  }
  return errores;
}
