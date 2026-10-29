// Tipo de cambio por fecha con Frankfurter (tipos de referencia del BCE,
// gratis y sin clave). Solo se envían la moneda y la fecha: ningún dato
// del documento ni de la empresa. Comprobado el 29/10/2026: para un fin de
// semana devuelve el último día hábil (p. ej. 06/09 → 04/09).

import type { Bd } from "@/servidor/bd/conexion";
import { guardarCambio, leerCambio, type TipoCambio } from "@/servidor/bd/cambios";

const URL_FRANKFURTER = "https://api.frankfurter.dev/v1";

/** Consulta Frankfurter. Devuelve null si no hay red o no hay dato. */
export async function consultarFrankfurter(moneda: string, fecha: string): Promise<TipoCambio | null> {
  try {
    const r = await fetch(`${URL_FRANKFURTER}/${fecha}?base=EUR&symbols=${encodeURIComponent(moneda)}`, { signal: AbortSignal.timeout(10_000) });
    if (!r.ok) return null;
    const j = (await r.json()) as { date: string; rates: Record<string, number> };
    const valor = j.rates?.[moneda];
    return typeof valor === "number" && valor > 0 ? { valor, fecha_bce: j.date } : null;
  } catch {
    return null;
  }
}

export type ProveedorCambio = (moneda: string, fecha: string) => Promise<TipoCambio | null>;

/** Tipo de cambio con caché en la base de datos (cada par moneda+fecha se pide una sola vez). */
export async function tipoDeCambio(bd: Bd, moneda: string, fecha: string, proveedor: ProveedorCambio = consultarFrankfurter): Promise<TipoCambio | null> {
  const guardado = leerCambio(bd, moneda, fecha);
  if (guardado) return guardado;
  const nuevo = await proveedor(moneda, fecha);
  if (nuevo) guardarCambio(bd, moneda, fecha, nuevo);
  return nuevo;
}
