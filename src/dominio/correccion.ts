// Esquemas de validación Zod y transformaciones para la corrección manual (RF-06).
// Mensajes de error en español y aptos para asociarse a campos con aria-describedby.

import { z } from "zod";
import { esCategoria } from "./categorias";
import { TIPOS_DOCUMENTO } from "./estados";

export function parsearImporteACentimos(texto: string | null | undefined): number | null {
  if (texto === null || texto === undefined) return null;
  const limpio = String(texto).trim().replace(/\s/g, "");
  if (!limpio) return null;

  let normalizado = limpio;
  if (normalizado.includes(",") && normalizado.includes(".")) {
    if (normalizado.indexOf(".") < normalizado.lastIndexOf(",")) {
      normalizado = normalizado.replace(/\./g, "").replace(",", ".");
    } else {
      normalizado = normalizado.replace(/,/g, "");
    }
  } else if (normalizado.includes(",")) {
    normalizado = normalizado.replace(",", ".");
  }

  const num = Number(normalizado);
  if (Number.isNaN(num)) return null;
  return Math.round(num * 100);
}

export function formatearCentimosAInput(centimos: number | null | undefined): string {
  if (centimos === null || centimos === undefined) return "";
  return (centimos / 100).toFixed(2).replace(".", ",");
}

export const esquemaLineaIva = z.object({
  tipo_iva: z.coerce.number().min(0, "El tipo de IVA debe ser mayor o igual a 0.").max(100, "El tipo de IVA no puede superar el 100 %."),
  base_centimos: z.number().int("La base debe ser un número entero de céntimos.").min(-1e11).max(1e11),
  cuota_centimos: z.number().int("La cuota debe ser un número entero de céntimos.").min(-1e11).max(1e11),
});

export const MAX_LINEAS_IVA = 20;

export const esquemaCorreccion = z.object({
  tipo: z.enum(TIPOS_DOCUMENTO, {
    message: "Selecciona factura completa o ticket simplificado.",
  }),
  nombre_emisor: z
    .string()
    .trim()
    .max(200, "El nombre del emisor no puede superar los 200 caracteres.")
    .nullable()
    .optional()
    .transform((v) => (v === "" ? null : v)),
  nif_emisor: z
    .string()
    .trim()
    .max(20, "El NIF del emisor no puede superar los 20 caracteres.")
    .nullable()
    .optional()
    .transform((v) => (v === "" ? null : v)),
  nif_receptor: z
    .string()
    .trim()
    .max(20, "El NIF del receptor no puede superar los 20 caracteres.")
    .nullable()
    .optional()
    .transform((v) => (v === "" ? null : v)),
  numero: z
    .string()
    .trim()
    .max(100, "El número de documento no puede superar los 100 caracteres.")
    .nullable()
    .optional()
    .transform((v) => (v === "" ? null : v)),
  fecha_emision: z
    .string()
    .trim()
    .nullable()
    .optional()
    .refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v), {
      message: "La fecha debe tener formato AAAA-MM-DD.",
    })
    .transform((v) => (v === "" ? null : v)),
  moneda: z
    .string()
    .trim()
    .nullable()
    .optional()
    .refine((v) => !v || v.length === 3, {
      message: "La moneda debe tener 3 letras (ej. EUR, USD).",
    })
    .transform((v) => (v ? v.toUpperCase() : null)),
  total_centimos: z.number().int("El total debe ser un importe válido.").min(-1e11).max(1e11).nullable().optional(),
  categoria: z
    .string()
    .trim()
    .nullable()
    .optional()
    // Sin el campo (undefined) no se toca; vacío = «sin categoría»
    .transform((v) => (v === undefined ? undefined : v || null))
    .refine((v) => v === undefined || v === null || esCategoria(v), { message: "Elige una categoría de la lista." }),
  lineas_iva: z.array(esquemaLineaIva).max(MAX_LINEAS_IVA, `Como máximo ${MAX_LINEAS_IVA} líneas de IVA.`).optional(),
});

export type EntradaCorreccion = z.infer<typeof esquemaCorreccion>;

export interface EstadoFormularioCorreccion {
  ok?: boolean;
  mensaje?: string;
  errores?: Record<string, string>;
}
