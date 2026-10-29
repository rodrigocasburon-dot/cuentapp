// Contrato de la lectura: lo que devuelve cualquier motor (y, en la fase 5,
// extractInvoice(file)). Cada campo lleva su valor y una confianza de 0 a 1.
// Si un campo no se encuentra: valor null y confianza 0.

import { z } from "zod";
import { TIPOS_DOCUMENTO } from "@/dominio/estados";

const confianza = z.number().min(0).max(1);

/** Envuelve un tipo de valor en { valor, confianza }. */
function campo<T extends z.ZodType>(valor: T) {
  return z.object({ valor: valor.nullable(), confianza });
}

export const LineaIvaSchema = z.object({
  tipo_iva: z.number().min(0).max(100),
  base_centimos: z.number().int(),
  cuota_centimos: z.number().int(),
});

export const ExtraccionSchema = z.object({
  tipo: campo(z.enum(TIPOS_DOCUMENTO)),
  nombre_emisor: campo(z.string().min(1)),
  nif_emisor: campo(z.string().min(1)),
  nif_receptor: campo(z.string().min(1)),
  numero: campo(z.string().min(1)),
  fecha_emision: campo(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha AAAA-MM-DD")),
  moneda: campo(z.string().regex(/^[A-Z]{3}$/, "Código ISO 4217")),
  total_centimos: campo(z.number().int()),
  lineas_iva: z.object({ valor: z.array(LineaIvaSchema), confianza }),
});

export type Extraccion = z.infer<typeof ExtraccionSchema>;
export type LineaIva = z.infer<typeof LineaIvaSchema>;

/** Los nombres de los campos, en el orden en que se informan. */
export const CAMPOS = [
  "tipo",
  "nombre_emisor",
  "nif_emisor",
  "nif_receptor",
  "numero",
  "fecha_emision",
  "moneda",
  "total_centimos",
  "lineas_iva",
] as const satisfies readonly (keyof Extraccion)[];
export type Campo = (typeof CAMPOS)[number];

/** Extracción vacía: punto de partida cuando un motor no lee nada. */
export function extraccionVacia(): Extraccion {
  const nada = { valor: null, confianza: 0 };
  return {
    tipo: nada,
    nombre_emisor: nada,
    nif_emisor: nada,
    nif_receptor: nada,
    numero: nada,
    fecha_emision: nada,
    moneda: nada,
    total_centimos: nada,
    lineas_iva: { valor: [], confianza: 0 },
  };
}
