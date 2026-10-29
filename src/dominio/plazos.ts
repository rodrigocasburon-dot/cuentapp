// Avisos de calendario para el panel (RFQ, «Avisos: trimestre a punto de
// cerrar»; D-59). Todo en hora de España y con aritmética de días civiles.
//
// Plazo general de presentación del IVA trimestral (modelo 303): del 1 al 20
// de abril, julio y octubre, y del 1 al 30 de enero para el 4T. Es el plazo
// general de la AEAT; con domiciliación el cargo se pide antes y puede haber
// prórrogas: por eso el texto remite siempre al gestor.

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
export const DIAS_AVISO_CIERRE = 15;

/** Día de hoy en España como fecha UTC a medianoche (solo para restar días). */
function hoyEnEspana(ahora: Date): Date {
  const [a, m, d] = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(ahora).split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d));
}

const diasEntre = (desde: Date, hasta: Date) => Math.round((hasta.getTime() - desde.getTime()) / 86_400_000);

export type AvisoPlazo =
  | { tipo: "cierre"; anio: number; trimestre: number; dias: number; texto: string }
  | { tipo: "presentacion"; anio: number; trimestre: number; dias: number; limite: string; texto: string };

/**
 * Avisos de hoy: el trimestre en curso acaba en ≤ 15 días y/o está abierto el
 * plazo de presentación del trimestre anterior. Lista vacía si no toca nada.
 */
export function avisosDePlazo(ahora = new Date()): AvisoPlazo[] {
  const hoy = hoyEnEspana(ahora);
  const anio = hoy.getUTCFullYear();
  const mes = hoy.getUTCMonth(); // 0 = enero
  const trimestre = Math.floor(mes / 3) + 1;
  const avisos: AvisoPlazo[] = [];

  // 1) Plazo de presentación del trimestre anterior (primer mes del trimestre)
  if (mes % 3 === 0) {
    const anterior = trimestre === 1 ? { anio: anio - 1, trimestre: 4 } : { anio, trimestre: trimestre - 1 };
    const diaLimite = trimestre === 1 ? 30 : 20;
    const dias = diasEntre(hoy, new Date(Date.UTC(anio, mes, diaLimite)));
    if (dias >= 0) {
      const limite = `${diaLimite} de ${MESES[mes]}`;
      avisos.push({
        tipo: "presentacion",
        ...anterior,
        dias,
        limite,
        texto: `El plazo general para presentar el IVA del ${anterior.trimestre}T ${anterior.anio} (modelo 303) acaba el ${limite}: ${dias === 0 ? "es hoy" : dias === 1 ? "queda 1 día" : `quedan ${dias} días`}. Confirma la fecha con tu gestor.`,
      });
    }
  }

  // 2) El trimestre en curso está a punto de acabar
  const fin = new Date(Date.UTC(anio, trimestre * 3, 0)); // último día del trimestre
  const dias = diasEntre(hoy, fin);
  if (dias <= DIAS_AVISO_CIERRE) {
    avisos.push({
      tipo: "cierre",
      anio,
      trimestre,
      dias,
      texto: `El ${trimestre}T ${anio} acaba ${dias === 0 ? "hoy" : dias === 1 ? "mañana" : `en ${dias} días`}. Sube los tickets y facturas que te falten y valídalos.`,
    });
  }
  return avisos;
}

/** Mes anterior a "AAAA-MM". */
export function mesAnterior(mes: string): string {
  const [a, m] = mes.split("-").map(Number);
  return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, "0")}`;
}

/** "2026-10" → "octubre de 2026" */
export function nombreMes(mes: string): string {
  const [a, m] = mes.split("-").map(Number);
  return `${MESES[m - 1]} de ${a}`;
}
