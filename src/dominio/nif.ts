// Validación determinista de identificadores fiscales españoles.
// Solo comprueba FORMATO y DÍGITO DE CONTROL; no consulta si existen.
//   * NIF de persona física (DNI): 8 cifras + letra.
//   * NIE: X/Y/Z + 7 cifras + letra.
//   * CIF / NIF de persona jurídica: letra + 7 cifras + control (cifra o letra).
// Los NIF que empiezan por K, L o M (casos especiales) se tratan como DNI
// con prefijo; no aparecen en el banco de pruebas.

const LETRAS_DNI = "TRWAGMYFPDXBNJZSQVHLCKE";
const LETRAS_CONTROL_CIF = "JABCDEFGHI";

/** Quita espacios, guiones y puntos y pasa a mayúsculas: "b-12.345.678" → "B12345678". */
export function normalizarNif(texto: string): string {
  return texto.toUpperCase().replace(/[\s.\-]/g, "");
}

export function letraDni(numero: number): string {
  return LETRAS_DNI[numero % 23];
}

/** Dígito de control de un CIF a partir de sus 7 cifras centrales. */
export function controlCif(sieteCifras: string): number {
  let suma = 0;
  for (let i = 0; i < 7; i++) {
    const d = Number(sieteCifras[i]);
    if (i % 2 === 0) {
      // posiciones impares (1.ª, 3.ª...): se dobla y se suman sus cifras
      const doble = d * 2;
      suma += Math.floor(doble / 10) + (doble % 10);
    } else {
      suma += d;
    }
  }
  return (10 - (suma % 10)) % 10;
}

export type TipoNif = "dni" | "nie" | "cif";

export function tipoNif(texto: string): TipoNif | null {
  const nif = normalizarNif(texto);
  if (/^\d{8}[A-Z]$/.test(nif)) return "dni";
  if (/^[XYZ]\d{7}[A-Z]$/.test(nif)) return "nie";
  if (/^[ABCDEFGHJNPQRSUVW]\d{7}[0-9A-J]$/.test(nif)) return "cif";
  return null;
}

export function nifValido(texto: string): boolean {
  const nif = normalizarNif(texto);
  switch (tipoNif(nif)) {
    case "dni":
      return letraDni(Number(nif.slice(0, 8))) === nif[8];
    case "nie": {
      const numero = Number("XYZ".indexOf(nif[0]) + nif.slice(1, 8));
      return letraDni(numero) === nif[8];
    }
    case "cif": {
      const control = controlCif(nif.slice(1, 8));
      const ultimo = nif[8];
      const letra = nif[0];
      // Estas entidades llevan letra de control; A, B, E y H, cifra; el resto admite ambas.
      if ("KPQSNW".includes(letra)) return ultimo === LETRAS_CONTROL_CIF[control];
      if ("ABEH".includes(letra)) return ultimo === String(control);
      return ultimo === String(control) || ultimo === LETRAS_CONTROL_CIF[control];
    }
    default:
      return false;
  }
}
