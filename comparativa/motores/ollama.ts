// Motor C: modelo de visión local servido por Ollama (http://127.0.0.1:11434).
// NO se ha medido todavía: el equipo no ha autorizado la descarga de Ollama
// y de los modelos (~7,5 GB). Si Ollama está en marcha con el modelo, la
// comparativa lo incluye sola. Modelo por defecto: qwen2.5vl:7b
// (cambiar con la variable OLLAMA_MODELO).
//
// Los modelos de visión no dan una confianza por campo fiable. Usamos 0,7
// para todo campo leído, y 0,95 / 0,5 según cuadren o no los importes.

import fs from "node:fs";
import { z } from "zod";
import { ExtraccionSchema, extraccionVacia, type Extraccion } from "@/lectura/esquema";
import type { Lectura, Motor } from "./tipos";

const URL_OLLAMA = "http://127.0.0.1:11434";
const MODELO = process.env.OLLAMA_MODELO ?? "qwen2.5vl:7b";

// Lo que le pedimos al modelo: solo valores, sin confianza
const Respuesta = z.object({
  tipo: z.enum(["factura_completa", "ticket_simplificado"]).nullable(),
  nombre_emisor: z.string().nullable(),
  nif_emisor: z.string().nullable(),
  nif_receptor: z.string().nullable(),
  numero: z.string().nullable(),
  fecha_emision: z.string().nullable(),
  moneda: z.string().nullable(),
  total_centimos: z.number().int().nullable(),
  lineas_iva: z.array(z.object({ tipo_iva: z.number(), base_centimos: z.number().int(), cuota_centimos: z.number().int() })),
});

const INSTRUCCIONES = `Eres un lector de facturas y tickets españoles. Extrae los datos de la imagen.
Reglas:
- tipo: "ticket_simplificado" si es un ticket o factura simplificada; "factura_completa" si identifica al cliente.
- NIF tal como aparece, sin espacios ni guiones. Si no aparece, null. No inventes.
- fecha_emision en formato AAAA-MM-DD.
- moneda en código ISO 4217 (EUR, USD...).
- Importes en CÉNTIMOS enteros (12,34 € → 1234).
- lineas_iva: una entrada por cada tipo de IVA con su base y su cuota.`;

function aExtraccion(r: z.infer<typeof Respuesta>): Extraccion {
  const suma = r.lineas_iva.reduce((s, l) => s + l.base_centimos + l.cuota_centimos, 0);
  const cuadra = r.total_centimos !== null && r.lineas_iva.length > 0 && Math.abs(suma - r.total_centimos) <= 1;
  const c = <T>(valor: T | null, conf = 0.7) => ({ valor, confianza: valor === null ? 0 : conf });
  return ExtraccionSchema.parse({
    tipo: c(r.tipo),
    nombre_emisor: c(r.nombre_emisor || null),
    nif_emisor: c(r.nif_emisor || null),
    nif_receptor: c(r.nif_receptor || null),
    numero: c(r.numero || null),
    fecha_emision: c(/^\d{4}-\d{2}-\d{2}$/.test(r.fecha_emision ?? "") ? r.fecha_emision : null),
    moneda: c(/^[A-Z]{3}$/.test(r.moneda ?? "") ? r.moneda : null),
    total_centimos: c(r.total_centimos, cuadra ? 0.95 : 0.5),
    lineas_iva: { valor: r.lineas_iva, confianza: r.lineas_iva.length ? (cuadra ? 0.95 : 0.5) : 0 },
  });
}

export const ollama: Motor = {
  id: "C",
  nombre: `Ollama · ${MODELO}`,
  local: true,

  async disponible() {
    try {
      const r = await fetch(`${URL_OLLAMA}/api/tags`, { signal: AbortSignal.timeout(2000) });
      const { models } = (await r.json()) as { models: { name: string }[] };
      return models.some((m) => m.name === MODELO) ? true : `Ollama está en marcha, pero sin el modelo ${MODELO}.`;
    } catch {
      return "Ollama no está instalado o no está en marcha (descarga no autorizada todavía).";
    }
  },

  async leer(archivos) {
    const lecturas: Lectura[] = [];
    for (const archivo of archivos) {
      const t = performance.now();
      try {
        const r = await fetch(`${URL_OLLAMA}/api/generate`, {
          method: "POST",
          body: JSON.stringify({
            model: MODELO,
            prompt: INSTRUCCIONES,
            images: [fs.readFileSync(archivo).toString("base64")],
            format: z.toJSONSchema(Respuesta),
            stream: false,
            options: { temperature: 0 },
          }),
        });
        const { response } = (await r.json()) as { response: string };
        lecturas.push({ archivo, texto: response, extraccion: aExtraccion(Respuesta.parse(JSON.parse(response))), segundos: (performance.now() - t) / 1000, coste_eur: 0 });
      } catch (e) {
        lecturas.push({ archivo, texto: "", extraccion: extraccionVacia(), segundos: (performance.now() - t) / 1000, coste_eur: 0, error: String(e) });
      }
    }
    // Ollama carga el modelo en la primera petición: ese tiempo va en el primer documento
    return { carga_segundos: 0, lecturas };
  },
};
