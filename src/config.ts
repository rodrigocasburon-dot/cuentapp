// Configuración global de Cuentapp.
//
// MODO "local" (MVP): SQLite + carpeta local, sin servicios externos de pago.
// MODO "produccion": solo documentado (Supabase Pro + Vercel Pro + Stripe);
// no está implementado. Ver SUPUESTOS.md, sección "MVP local frente a producción".

import path from "node:path";

export type Modo = "local" | "produccion";

export const MODO: Modo = process.env.CUENTAPP_MODO === "produccion" ? "produccion" : "local";

// Carpeta de datos (base de datos y originales). Fuera de git.
export const CARPETA_DATOS = process.env.CUENTAPP_DATOS ?? path.join(process.cwd(), "datos");
export const RUTA_BD = path.join(CARPETA_DATOS, "cuentapp.db");
export const CARPETA_ORIGINALES = path.join(CARPETA_DATOS, "originales");
