// Caché de tipos de cambio (datos de referencia, no de ninguna empresa).

import type { Bd } from "./conexion";

export interface TipoCambio {
  valor: number;      // 1 EUR = valor unidades de la moneda
  fecha_bce: string;  // día hábil cuyo tipo se aplica
}

export function leerCambio(bd: Bd, moneda: string, fecha: string): TipoCambio | undefined {
  return bd.prepare("SELECT valor, fecha_bce FROM tipos_cambio WHERE moneda = ? AND fecha_pedida = ?").get(moneda, fecha) as
    | TipoCambio
    | undefined;
}

export function guardarCambio(bd: Bd, moneda: string, fecha: string, t: TipoCambio): void {
  bd.prepare("INSERT OR REPLACE INTO tipos_cambio (moneda, fecha_pedida, fecha_bce, valor) VALUES (?, ?, ?, ?)").run(moneda, fecha, t.fecha_bce, t.valor);
}
