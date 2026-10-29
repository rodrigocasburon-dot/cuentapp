// Criterios PL-01..PL-04 (PROPUESTA: ver docs/pruebas-lectura.md).
// Si el documento de decisiones consolidado fija otros umbrales, cámbialos
// aquí y vuelve a ejecutar la comparativa.

import { CAMPOS } from "@/lectura/esquema";
import type { PuntuacionDocumento } from "./puntuar";
import type { Verdad } from "./verdad";

export const UMBRALES = {
  pl01_campos: 0.9,
  pl02_campos_foto: 0.75,
  pl02_errores_confiados_ilegible: 0,
  pl03_total: 0.95,
  pl03_desglose: 0.8,
  pl03_tipo: 0.9,
  pl04_segundos: 15,
};

export interface DocumentoPuntuado {
  verdad: Verdad;
  p: PuntuacionDocumento;
  segundos: number;
  coste_eur: number;
}

export interface Veredicto {
  prueba: "PL-01" | "PL-02" | "PL-03" | "PL-04";
  supera: boolean | null;   // null = no hay documentos para medirla
  medida: string;
}

const pct = (x: number) => `${(x * 100).toFixed(0)} %`;
const proporcion = (docs: DocumentoPuntuado[], f: (d: DocumentoPuntuado) => boolean) =>
  docs.length ? docs.filter(f).length / docs.length : NaN;
const camposCorrectos = (docs: DocumentoPuntuado[]) =>
  docs.reduce((s, d) => s + d.p.correctos, 0) / (docs.length * CAMPOS.length);

export function evaluar(docs: DocumentoPuntuado[], local: boolean): Veredicto[] {
  const sinDuplicados = docs.filter((d) => !d.verdad.copia_de);
  const limpios = sinDuplicados.filter((d) => d.verdad.degradacion === "ninguna");
  const fotos = sinDuplicados.filter((d) => d.verdad.degradacion === "foto");
  const ilegibles = sinDuplicados.filter((d) => d.verdad.degradacion === "ilegible");
  const legibles = sinDuplicados.filter((d) => d.verdad.degradacion !== "ilegible");

  const v: Veredicto[] = [];

  // PL-01: documentos limpios
  if (limpios.length) {
    const r = camposCorrectos(limpios);
    v.push({ prueba: "PL-01", supera: r >= UMBRALES.pl01_campos, medida: `${pct(r)} campos correctos en ${limpios.length} docs (umbral ${pct(UMBRALES.pl01_campos)})` });
  } else v.push({ prueba: "PL-01", supera: null, medida: "sin documentos limpios" });

  // PL-02: degradados
  if (fotos.length || ilegibles.length) {
    const rFoto = fotos.length ? camposCorrectos(fotos) : NaN;
    const confiados = ilegibles.reduce((s, d) => s + d.p.errores_confiados, 0);
    const okFoto = !fotos.length || rFoto >= UMBRALES.pl02_campos_foto;
    const okIleg = confiados <= UMBRALES.pl02_errores_confiados_ilegible;
    v.push({
      prueba: "PL-02",
      supera: okFoto && okIleg,
      medida: `fotos: ${fotos.length ? pct(rFoto) : "—"} campos correctos (umbral ${pct(UMBRALES.pl02_campos_foto)}) · ilegibles: ${confiados} errores confiados (umbral ${UMBRALES.pl02_errores_confiados_ilegible})`,
    });
  } else v.push({ prueba: "PL-02", supera: null, medida: "sin documentos degradados" });

  // PL-03: importes, IVA y tipo
  if (legibles.length) {
    const t = proporcion(legibles, (d) => d.p.total_ok);
    const g = proporcion(legibles, (d) => d.p.desglose_ok);
    const k = proporcion(legibles, (d) => d.p.tipo_ok);
    v.push({
      prueba: "PL-03",
      supera: t >= UMBRALES.pl03_total && g >= UMBRALES.pl03_desglose && k >= UMBRALES.pl03_tipo,
      medida: `total ${pct(t)} · desglose IVA ${pct(g)} · tipo ${pct(k)} (umbrales ${pct(UMBRALES.pl03_total)} / ${pct(UMBRALES.pl03_desglose)} / ${pct(UMBRALES.pl03_tipo)})`,
    });
  } else v.push({ prueba: "PL-03", supera: null, medida: "sin documentos legibles" });

  // PL-04: tiempo, coste y privacidad
  const media = docs.reduce((s, d) => s + d.segundos, 0) / Math.max(docs.length, 1);
  const coste = docs.reduce((s, d) => s + d.coste_eur, 0);
  v.push({
    prueba: "PL-04",
    supera: media <= UMBRALES.pl04_segundos && coste === 0 && local,
    medida: `${media.toFixed(1)} s/doc de media (umbral ${UMBRALES.pl04_segundos} s) · coste ${coste.toFixed(2)} € · ${local ? "local" : "ENVÍA DATOS FUERA"}`,
  });
  return v;
}
