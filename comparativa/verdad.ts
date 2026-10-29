// Formato de los ficheros de "verdad" del banco (banco-tickets/**/<id>.json).
// Los reales los escribe el equipo a mano con este mismo formato.

import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { LineaIvaSchema } from "@/lectura/esquema";

export const VerdadSchema = z.object({
  id: z.string(),
  descripcion: z.string().optional(),
  degradacion: z.enum(["ninguna", "foto", "ilegible"]).default("ninguna"),
  copia_de: z.string().optional(),
  tipo: z.enum(["factura_completa", "ticket_simplificado"]),
  nombre_emisor: z.string().nullable(),
  nif_emisor: z.string().nullable(),
  nif_receptor: z.string().nullable(),
  numero: z.string().nullable(),
  fecha_emision: z.string().nullable(),
  moneda: z.string(),
  total_centimos: z.number().int(),
  lineas_iva: z.array(LineaIvaSchema),
});
export type Verdad = z.infer<typeof VerdadSchema>;

/** Lee todos los <id>.json que tengan una imagen al lado (png, jpg, jpeg, webp). */
export function leerBanco(carpeta: string): { verdad: Verdad; imagen: string }[] {
  const docs: { verdad: Verdad; imagen: string }[] = [];
  for (const f of fs.readdirSync(carpeta).filter((f) => f.endsWith(".json") && f !== "indice.json").sort()) {
    const id = f.slice(0, -5);
    const imagen = ["png", "jpg", "jpeg", "webp"].map((e) => path.join(carpeta, `${id}.${e}`)).find((p) => fs.existsSync(p));
    if (!imagen) continue;
    const verdad = VerdadSchema.parse({ id, ...JSON.parse(fs.readFileSync(path.join(carpeta, f), "utf8")) });
    docs.push({ verdad, imagen });
  }
  return docs;
}
