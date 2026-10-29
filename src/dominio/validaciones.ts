// Validaciones DETERMINISTAS de una lectura (RF-05). No dependen del motor:
// se aplican igual a cualquier Extraccion. Cada problema es un "aviso":
//   rojo  → bloquea (incidencia): el documento no se puede dar por bueno
//   ambar → hay que revisarlo (campo dudoso, falta un NIF, no cuadra...)
//   info  → solo informativo, no cambia el semáforo
// El semáforo del trimestre (fase 7) se calcula a partir de estos niveles.

import type { Campo, Extraccion } from "@/lectura/esquema";
import { nifValido, normalizarNif, tipoNif } from "./nif";

export type Nivel = "rojo" | "ambar" | "info";

export interface Aviso {
  codigo: string;
  nivel: Nivel;
  texto: string;     // para el usuario, en español
  campo?: Campo;
}

/** Por debajo de esta confianza, un campo leído se marca como dudoso. */
export const CONFIANZA_DUDOSA = 0.6;

/** Tipos de IVA vigentes en España (general, reducido, superreducido y el 5 % temporal). */
export const TIPOS_IVA_ES = [0, 4, 5, 10, 21];

/** Monedas que publica el BCE (y por tanto Frankfurter) además del euro. */
export const MONEDAS = [
  "EUR", "USD", "GBP", "CHF", "JPY", "CNY", "CAD", "AUD", "NZD", "SEK", "NOK", "DKK", "PLN", "CZK", "HUF",
  "RON", "BGN", "ISK", "TRY", "MXN", "BRL", "INR", "KRW", "SGD", "HKD", "ZAR", "ILS", "THB", "MYR", "IDR", "PHP",
];

const NOMBRE_CAMPO: Record<Campo, string> = {
  tipo: "tipo de documento",
  nombre_emisor: "emisor",
  nif_emisor: "NIF del emisor",
  nif_receptor: "NIF del receptor",
  numero: "número",
  fecha_emision: "fecha",
  moneda: "moneda",
  total_centimos: "total",
  lineas_iva: "desglose de IVA",
};

const euros = (c: number) => (c / 100).toLocaleString("es-ES", { minimumFractionDigits: 2 });

/** Datos de la empresa que sube el documento, para validar que va a su nombre. */
export interface Contexto {
  nifEmpresa?: string | null;
}

/** Con esta confianza o más, un NIF de receptor ajeno bloquea; con menos, solo pide revisión. */
const CONFIANZA_PARA_BLOQUEAR = 0.8;

export function validar(ex: Extraccion, hoy = new Date(), contexto: Contexto = {}): Aviso[] {
  // 1) ¿Se ha podido leer algo? Si no, no tiene sentido validar lo demás.
  const leidos = (["nombre_emisor", "nif_emisor", "numero", "fecha_emision", "total_centimos"] as const).filter((c) => ex[c].valor !== null).length
    + (ex.lineas_iva.valor.length ? 1 : 0);
  if (leidos < 2) {
    return [{ codigo: "ilegible", nivel: "rojo", texto: "No se ha podido leer el documento. Sube una imagen más nítida o rellena los datos a mano." }];
  }

  const avisos: Aviso[] = [];
  const av = (codigo: string, nivel: Nivel, texto: string, campo?: Campo) => avisos.push({ codigo, nivel, texto, campo });

  // 2) Identificadores fiscales
  for (const campo of ["nif_emisor", "nif_receptor"] as const) {
    const nif = ex[campo].valor;
    if (nif && !nifValido(nif)) {
      av(`${campo}_invalido`, "ambar", tipoNif(nif) ? `El ${NOMBRE_CAMPO[campo]} (${nif}) tiene un dígito de control incorrecto.` : `El ${NOMBRE_CAMPO[campo]} (${nif}) no tiene formato español.`, campo);
    }
  }
  // ¿Va a nombre de otra empresa? (problema documental: no serviría para tu contabilidad)
  const receptor = ex.nif_receptor.valor;
  if (receptor && contexto.nifEmpresa && normalizarNif(receptor) !== normalizarNif(contexto.nifEmpresa)) {
    const seguro = nifValido(receptor) && ex.nif_receptor.confianza >= CONFIANZA_PARA_BLOQUEAR;
    av(
      "receptor_ajeno",
      seguro ? "rojo" : "ambar",
      `El documento va a nombre de ${receptor}, no de tu empresa (${contexto.nifEmpresa}).${seguro ? "" : " Comprueba si el NIF se ha leído bien."}`,
      "nif_receptor",
    );
  }
  if (ex.tipo.valor === "factura_completa") {
    if (!ex.nif_emisor.valor) av("falta_nif_emisor", "ambar", "Es una factura completa y no consta el NIF del emisor.", "nif_emisor");
    if (!ex.nif_receptor.valor) av("falta_nif_receptor", "ambar", "Es una factura completa y no consta tu NIF como receptor.", "nif_receptor");
  } else if (!ex.nif_receptor.valor) {
    av("ticket_sin_nif_receptor", "info", "Ticket simplificado sin tu NIF: puede no servir para deducir el IVA.");
  }

  // 3) Importes e IVA
  const total = ex.total_centimos.valor;
  const lineas = ex.lineas_iva.valor;
  if (total === null) av("falta_total", "ambar", "No se ha encontrado el total.", "total_centimos");
  if (lineas.length === 0) av("falta_desglose_iva", "ambar", "No se ha encontrado el desglose de IVA.", "lineas_iva");
  if (total !== null && lineas.length) {
    const suma = lineas.reduce((s, l) => s + l.base_centimos + l.cuota_centimos, 0);
    // Tolerancia: 1 céntimo por línea (redondeos de cada tipo de IVA)
    if (Math.abs(suma - total) > lineas.length) {
      av("descuadre_total", "ambar", `Bases + cuotas suman ${euros(suma)} y el total es ${euros(total)}.`, "total_centimos");
    }
  }
  for (const l of lineas) {
    if (Math.abs(l.cuota_centimos - (l.base_centimos * l.tipo_iva) / 100) > 1) {
      av("cuota_incorrecta", "ambar", `La cuota del IVA ${l.tipo_iva} % (${euros(l.cuota_centimos)}) no corresponde a su base (${euros(l.base_centimos)}).`, "lineas_iva");
    }
    if (!TIPOS_IVA_ES.includes(l.tipo_iva)) {
      av("tipo_iva_no_espanol", "ambar", `IVA del ${l.tipo_iva} %: no es un tipo español. Revisa si es correcto.`, "lineas_iva");
    }
  }

  // 4) Fecha plausible: ni futura ni de hace más de 4 años
  const fecha = ex.fecha_emision.valor;
  if (!fecha) av("falta_fecha", "ambar", "No se ha encontrado la fecha.", "fecha_emision");
  else {
    const hoyIso = hoy.toISOString().slice(0, 10);
    const limite = `${hoy.getUTCFullYear() - 4}-01-01`;
    if (fecha > hoyIso) av("fecha_no_plausible", "ambar", `La fecha (${fecha}) es posterior a hoy.`, "fecha_emision");
    else if (fecha < limite) av("fecha_no_plausible", "ambar", `La fecha (${fecha}) es de hace más de 4 años.`, "fecha_emision");
  }

  // 5) Moneda
  const moneda = ex.moneda.valor;
  if (moneda && !MONEDAS.includes(moneda)) av("moneda_desconocida", "ambar", `Moneda no reconocida: ${moneda}.`, "moneda");
  else if (moneda && moneda !== "EUR") av("moneda_extranjera", "info", `Importes en ${moneda}: se convierten a euros con el tipo del BCE de esa fecha.`);

  // 6) Campos leídos con poca seguridad
  for (const [campo, { valor, confianza }] of Object.entries(ex) as [Campo, { valor: unknown; confianza: number }][]) {
    const vacio = valor === null || (Array.isArray(valor) && valor.length === 0);
    if (!vacio && confianza < CONFIANZA_DUDOSA) {
      av("campo_dudoso", "ambar", `Revisa el ${NOMBRE_CAMPO[campo]}: se ha leído con poca seguridad.`, campo);
    }
  }
  return avisos;
}

/** El aviso más grave decide: rojo > ámbar > info. */
export function nivelMaximo(avisos: Aviso[]): Nivel | null {
  if (avisos.some((a) => a.nivel === "rojo")) return "rojo";
  if (avisos.some((a) => a.nivel === "ambar")) return "ambar";
  return avisos.length ? "info" : null;
}
