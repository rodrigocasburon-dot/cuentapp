// Configuración global de Cuentapp.
//
// MODO "local" (MVP): SQLite + carpeta local, sin servicios externos de pago.
// MODO "produccion": solo documentado (Supabase Pro + Vercel Pro + Stripe);
// no está implementado. Ver SUPUESTOS.md, sección "MVP local frente a producción".

import path from "node:path";

export type Modo = "local" | "produccion";

export const MODO: Modo = process.env.CUENTAPP_MODO === "produccion" ? "produccion" : "local";

// Acceso de demostración: botones en /entrar para entrar sin contraseña con
// las cuentas de prueba de db:reset. SOLO en local y en desarrollo (npm run dev);
// con npm run build/start o en producción desaparece y la acción se niega.
export const ACCESO_DEMO = MODO === "local" && process.env.NODE_ENV === "development";
export const CUENTAS_DEMO = [
  { email: "ana@panaderia.test", empresa: "Panadería Ejemplo S.L." },
  { email: "beto@talleres.test", empresa: "Talleres Ficticios S.L." },
] as const;

// Carpeta de datos (base de datos y originales). Fuera de git.
export const CARPETA_DATOS = process.env.CUENTAPP_DATOS ?? path.join(process.cwd(), "datos");
export const RUTA_BD = path.join(CARPETA_DATOS, "cuentapp.db");
export const CARPETA_ORIGINALES = path.join(CARPETA_DATOS, "originales");
// Copia local ordenada para el gestor (fase 8). En producción: Google Drive.
export const CARPETA_COPIA = process.env.CUENTAPP_COPIA ?? path.join(CARPETA_DATOS, "copia");
