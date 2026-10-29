// Analizador común: convierte el TEXTO que devuelve un OCR (Tesseract,
// RapidOCR...) en una Extraccion con confianza por campo.
//
// Son reglas sencillas (expresiones regulares sobre líneas). No pretende ser
// perfecto: su papel es que los motores OCR se comparen en igualdad de
// condiciones. Cada regla está separada para poder mejorarla y probarla sola
// (tests/analizar-texto.test.ts).
//
// Confianza: cada campo parte de una confianza según CÓMO se encontró
// (con etiqueta, por descarte...) y se multiplica por la confianza media que
// el propio OCR da a su lectura. Así un documento borroso nunca da campos
// "seguros".

import { nifValido, normalizarNif } from "@/dominio/nif";
import { extraccionVacia, type Extraccion, type LineaIva } from "./esquema";

// ---------------------------------------------------------------------
// Utilidades de texto
// ---------------------------------------------------------------------

/** Quita tildes y pasa a mayúsculas: "Fecha: 14/07" → "FECHA: 14/07". */
export function plano(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
}

// Importe con 2 decimales: "1.250,00", "1250,00", "12,50", "12.50", "-3,10"
const RE_IMPORTE = /-?\d{1,3}(?:[.\s]\d{3})+[.,]\d{2}(?!\d)|-?\d+[.,]\d{2}(?!\d)/g;

/** "1.250,00" → 125000 · "12.50" → 1250. Devuelve null si no es un importe. */
export function aCentimos(texto: string): number | null {
  const limpio = texto.replace(/\s/g, "");
  const m = /^(-?)([\d.,]*?)[.,](\d{2})$/.exec(limpio);
  if (!m) return null;
  const enteros = m[2].replace(/[.,]/g, "") || "0";
  const valor = Number(enteros) * 100 + Number(m[3]);
  return Number.isFinite(valor) ? (m[1] ? -valor : valor) : null;
}

/** Todos los importes de una línea, en orden. */
export function importesDe(linea: string): number[] {
  return (linea.match(RE_IMPORTE) ?? []).map(aCentimos).filter((x): x is number => x !== null);
}

/** "14/07/2026", "14-07-26", "2026-07-14" → "2026-07-14" (o null si no es una fecha real). */
export function aFechaIso(texto: string): string | null {
  let d: number, m: number, a: number;
  const iso = /(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(texto);
  const es = /(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/.exec(texto);
  if (iso) [a, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  else if (es) {
    [d, m, a] = [Number(es[1]), Number(es[2]), Number(es[3])];
    if (a < 100) a += 2000;
  } else return null;
  const f = new Date(Date.UTC(a, m - 1, d));
  if (f.getUTCFullYear() !== a || f.getUTCMonth() !== m - 1 || f.getUTCDate() !== d) return null;
  return `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * Corrige confusiones típicas del OCR dentro de un candidato a NIF:
 * en las posiciones que deben ser cifras, O→0, I/L→1, S→5, B→8, Z→2.
 */
const A_CIFRA: Record<string, string> = { O: "0", Q: "0", D: "0", I: "1", L: "1", S: "5", B: "8", Z: "2", G: "6" };
const PRIMERAS_VALIDAS = "ABCDEFGHJNPQRSUVWXYZ"; // letras con las que puede empezar un CIF o NIE

function repararNif(candidato: string): string {
  const c = normalizarNif(candidato);
  if (c.length !== 9) return c;
  const centro = c.slice(1, 8).replace(/[OQDILSBZG]/g, (x) => A_CIFRA[x]);
  // La primera posición es letra en CIF/NIE y cifra en DNI
  const primera = /\d/.test(c[0]) || PRIMERAS_VALIDAS.includes(c[0]) ? c[0] : (A_CIFRA[c[0]] ?? c[0]);
  return primera + centro + c[8];
}

/** Candidatos a NIF de una línea, ya normalizados y reparados. */
function nifsDe(linea: string): string[] {
  // Unir "B-12.345.678" → "B12345678" (solo puntos y guiones entre letras/cifras)
  const p = plano(linea).replace(/(?<=[A-Z0-9])[.-](?=[A-Z0-9])/g, "");
  return (p.match(/\b[A-Z0-9][0-9OQDILSBZG]{7}[A-Z0-9]\b/g) ?? [])
    .map(repararNif)
    .filter((n) => /^([A-Z]\d{7}[0-9A-J]|\d{8}[A-Z]|[XYZ]\d{7}[A-Z])$/.test(n));
}

// ---------------------------------------------------------------------
// Reglas por campo
// ---------------------------------------------------------------------

type ConFuente<T> = { valor: T | null; base: number };
const nada = <T>(): ConFuente<T> => ({ valor: null, base: 0 });

/** NIF del emisor y del receptor. El receptor es el que aparece tras "Cliente". */
function buscarNifs(lineas: string[]): { emisor: ConFuente<string>; receptor: ConFuente<string> } {
  const inicioCliente = lineas.findIndex((l) => /\b(CLIENTE|DESTINATARIO|RECEPTOR|FACTURAR A)\b/.test(plano(l)));
  const candidatos: { nif: string; conEtiqueta: boolean; esReceptor: boolean }[] = [];
  lineas.forEach((l, i) => {
    const p = plano(l);
    // Una línea con "Nº" o "FACTURA" lleva el número del documento, que puede parecer un CIF
    if (/N[º°]|\bNUM|\bFACTURA\s+N/.test(p) && !/\b(NIF|CIF)\b/.test(p)) return;
    for (const nif of nifsDe(l)) {
      candidatos.push({
        nif,
        conEtiqueta: /\b(N\.?I\.?F|C\.?I\.?F|NIE|VAT)\b/.test(p),
        esReceptor: inicioCliente >= 0 && i >= inicioCliente && i <= inicioCliente + 4,
      });
    }
  });
  const elegir = (lista: typeof candidatos): ConFuente<string> => {
    // Primero los que llevan etiqueta "NIF:"; si no hay, el primero que aparezca
    const c = lista.find((x) => x.conEtiqueta) ?? lista[0];
    if (!c) return nada();
    return { valor: c.nif, base: (c.conEtiqueta ? 0.8 : 0.55) + (nifValido(c.nif) ? 0.15 : 0) };
  };
  return {
    emisor: elegir(candidatos.filter((c) => !c.esReceptor)),
    receptor: elegir(candidatos.filter((c) => c.esReceptor)),
  };
}

/** Nombre del emisor: la primera línea con aspecto de nombre (letras, sin etiquetas). */
function buscarNombreEmisor(lineas: string[]): ConFuente<string> {
  for (const l of lineas.slice(0, 6)) {
    const limpia = l.replace(/\b(FACTURA|TICKET)\b.*$/i, "").trim();
    const letras = (limpia.match(/[A-Za-zÁÉÍÓÚÑáéíóúñ]/g) ?? []).length;
    if (letras >= 4 && !/\b(NIF|CIF|FECHA|N[º°O]\b|TEL)/i.test(limpia) && !/\d{5}/.test(limpia)) {
      return { valor: limpia, base: 0.75 };
    }
  }
  return nada();
}

function buscarNumero(lineas: string[]): ConFuente<string> {
  for (const l of lineas) {
    const p = plano(l);
    if (/\b(NIF|CIF|TEL)\b/.test(p)) continue;
    const m =
      // "Nº" llega del OCR como Nº, N°, No, Ne o N?. El número debe contener
      // al menos una cifra: así "NO SE ADMITEN" no cuenta.
      /\b(?:N[º°OE?*]\.?|NUM(?:ERO)?\.?|FACTURA\s+N[º°O]?\.?|TICKET\s+N[º°O]?\.?)\s*:?\s*((?=[A-Z0-9\-/.]*\d)[A-Z0-9][A-Z0-9\-/.]{2,})/.exec(p) ??
      /\b(INV(?:OICE)?[-\s#]*\d[\w-]*)/.exec(p);
    if (m) return { valor: m[1].replace(/\s+/g, ""), base: 0.8 };
  }
  return nada();
}

function buscarFecha(lineas: string[]): ConFuente<string> {
  const conEtiqueta = lineas.find((l) => /FECHA|DATE/.test(plano(l)) && aFechaIso(l));
  if (conEtiqueta) return { valor: aFechaIso(conEtiqueta), base: 0.9 };
  const cualquiera = lineas.find((l) => aFechaIso(l));
  return cualquiera ? { valor: aFechaIso(cualquiera), base: 0.6 } : nada();
}

function buscarMoneda(texto: string): ConFuente<string> {
  const p = plano(texto);
  if (/\bUSD\b|US\$|\$\s?\d/.test(p)) return { valor: "USD", base: 0.85 };
  if (/\bGBP\b|£/.test(p)) return { valor: "GBP", base: 0.85 };
  if (/€|\bEUR\b|EUROS?\b/.test(p)) return { valor: "EUR", base: 0.9 };
  return { valor: "EUR", base: 0.5 }; // por defecto: lo más probable en España
}

/** Una línea que solo contiene un importe (y quizá el símbolo de moneda). */
function soloImporte(linea: string | undefined): number | null {
  if (!linea || !/^[\s€$£]*-?[\d.,\s]+[\s€$£]*$/.test(linea)) return null;
  const importes = importesDe(linea);
  return importes.length === 1 ? importes[0] : null;
}

function buscarTotal(lineas: string[]): ConFuente<number> {
  for (let i = 0; i < lineas.length; i++) {
    const p = plano(lineas[i]);
    if (!/\bTOTAL\b/.test(p) || /SUBTOTAL|BASE|\bIVA\b/.test(p)) continue;
    const importes = importesDe(lineas[i]);
    if (importes.length) return { valor: importes[importes.length - 1], base: 0.85 };
    // En una foto inclinada, el OCR puede poner el importe en la línea de
    // al lado. Solo lo aceptamos si esa línea no tiene nada más.
    const vecino = soloImporte(lineas[i - 1]) ?? soloImporte(lineas[i + 1]);
    if (vecino !== null) return { valor: vecino, base: 0.6 };
  }
  return nada();
}

function buscarLineasIva(lineas: string[]): ConFuente<LineaIva[]> {
  const baseGlobal = lineas
    .filter((l) => /BASE\s+IMPONIBLE/.test(plano(l)))
    .map((l) => importesDe(l).at(-1))
    .find((x) => x !== undefined);
  const resultado: LineaIva[] = [];
  for (const l of lineas) {
    const m = /\b(?:IVA|I\.V\.A\.?|VAT)\s*(\d{1,2}(?:[.,]\d{1,2})?)\s*%/.exec(plano(l));
    if (!m) continue;
    const tipo_iva = Number(m[1].replace(",", "."));
    // Importes de la línea DESPUÉS del porcentaje
    const importes = importesDe(l.slice(l.indexOf("%") + 1));
    if (importes.length >= 2) {
      resultado.push({ tipo_iva, base_centimos: importes[0], cuota_centimos: importes[importes.length - 1] });
    } else if (importes.length === 1 && baseGlobal !== undefined) {
      resultado.push({ tipo_iva, base_centimos: baseGlobal, cuota_centimos: importes[0] });
    }
  }
  return resultado.length ? { valor: resultado, base: 0.8 } : nada();
}

function buscarTipo(texto: string, hayReceptor: boolean): ConFuente<"factura_completa" | "ticket_simplificado"> {
  const p = plano(texto);
  if (/SIMPLIFICADA|\bTICKET\b/.test(p)) return { valor: "ticket_simplificado", base: 0.9 };
  if (/\bFACTURA\b|\bINVOICE\b/.test(p)) return { valor: "factura_completa", base: hayReceptor || /CLIENTE/.test(p) ? 0.85 : 0.6 };
  return { valor: "ticket_simplificado", base: 0.4 };
}

// ---------------------------------------------------------------------
// Función principal
// ---------------------------------------------------------------------

/**
 * @param texto      Texto del OCR, con saltos de línea.
 * @param confianzaOcr Confianza media del OCR (0..1). Si el motor no la da, usa 0.8.
 */
export function analizarTexto(textoOcr: string, confianzaOcr = 0.8): Extraccion {
  // NFKC: convierte caracteres "raros" del OCR en los normales (":" de ancho
  // completo → ":", "º" → "o"). Las reglas cuentan con ello.
  const texto = textoOcr.normalize("NFKC");
  const lineas = texto.split(/\r?\n/).map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
  if (lineas.length === 0) return extraccionVacia();

  const { emisor, receptor } = buscarNifs(lineas);
  const total = buscarTotal(lineas);
  const iva = buscarLineasIva(lineas);
  const tipo = buscarTipo(texto, receptor.valor !== null);

  // Validación cruzada: si bases + cuotas = total, ambos campos ganan confianza
  if (total.valor !== null && iva.valor) {
    const suma = iva.valor.reduce((s, l) => s + l.base_centimos + l.cuota_centimos, 0);
    const cuadra = Math.abs(suma - total.valor) <= 1;
    total.base = cuadra ? 0.97 : Math.min(total.base, 0.6);
    iva.base = cuadra ? 0.95 : Math.min(iva.base, 0.6);
  }

  const k = Math.max(0, Math.min(1, confianzaOcr));
  const fin = <T>(c: ConFuente<T>) => ({ valor: c.valor, confianza: c.valor === null ? 0 : round2(c.base * k) });

  return {
    tipo: fin(tipo),
    nombre_emisor: fin(buscarNombreEmisor(lineas)),
    nif_emisor: fin(emisor),
    nif_receptor: fin(receptor),
    numero: fin(buscarNumero(lineas)),
    fecha_emision: fin(buscarFecha(lineas)),
    moneda: fin(buscarMoneda(texto)),
    total_centimos: fin(total),
    lineas_iva: { valor: iva.valor ?? [], confianza: iva.valor ? round2(iva.base * k) : 0 },
  };
}

const round2 = (x: number) => Math.round(x * 100) / 100;
