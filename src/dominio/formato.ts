// Formatos de presentación en español (hora de España).

const FECHA_HORA = new Intl.DateTimeFormat("es-ES", {
  timeZone: "Europe/Madrid",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** "2026-10-29T08:05:00Z" → "29/10/2026, 9:05" */
export function fechaHora(iso: string): string {
  return FECHA_HORA.format(new Date(iso));
}

/** "2026-07-14" → "14/07/2026" */
export function fecha(isoDia: string): string {
  const [a, m, d] = isoDia.split("-");
  return `${d}/${m}/${a}`;
}

/**
 * 151250, "EUR" → "1512,50 €" · 4999, "USD" → "49,99 US$".
 * (En es-ES, Intl no pone punto de miles en números de 4 cifras: es la norma de la RAE.)
 */
export function importe(centimos: number, moneda = "EUR"): string {
  try {
    return (centimos / 100).toLocaleString("es-ES", { style: "currency", currency: moneda });
  } catch {
    return `${(centimos / 100).toLocaleString("es-ES", { minimumFractionDigits: 2 })} ${moneda}`; // moneda desconocida
  }
}

/** Mes "AAAA-MM" en hora de España (no UTC: a medianoche del día 1 importa). */
export function mesDe(fecha: Date): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit" }).format(fecha);
}

/** 1536 → "1,5 kB" · 2_400_000 → "2,3 MB" */
export function tamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toLocaleString("es-ES", { maximumFractionDigits: 1 })} kB`;
  return `${(kb / 1024).toLocaleString("es-ES", { maximumFractionDigits: 1 })} MB`;
}
