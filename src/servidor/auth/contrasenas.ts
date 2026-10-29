// Contraseñas con scrypt (incluido en Node, sin dependencias).
// Parámetros de OWASP para scrypt: N = 2^17, r = 8, p = 1 (usa ~128 MB y
// tarda unas décimas de segundo: a propósito, para frenar ataques de fuerza bruta).
//
// Formato guardado: "scrypt$17$8$1$<sal base64>$<hash base64>". Lleva sus
// parámetros dentro, así podremos endurecerlos sin invalidar las antiguas.

import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

const LOG_N = 17;
const R = 8;
const P = 1;
const LONGITUD = 64;

function derivar(contrasena: string, sal: Buffer, logN: number, r: number, p: number): Promise<Buffer> {
  const opciones: ScryptOptions = { N: 2 ** logN, r, p, maxmem: 256 * 1024 * 1024 };
  return new Promise((resolver, rechazar) =>
    scrypt(contrasena.normalize("NFC"), sal, LONGITUD, opciones, (e, clave) => (e ? rechazar(e) : resolver(clave))),
  );
}

export async function cifrarContrasena(contrasena: string): Promise<string> {
  const sal = randomBytes(16);
  const hash = await derivar(contrasena, sal, LOG_N, R, P);
  return ["scrypt", LOG_N, R, P, sal.toString("base64"), hash.toString("base64")].join("$");
}

export async function verificarContrasena(contrasena: string, guardada: string): Promise<boolean> {
  const [alg, logN, r, p, sal, hash] = guardada.split("$");
  if (alg !== "scrypt" || !sal || !hash) return false;
  const esperado = Buffer.from(hash, "base64");
  const calculado = await derivar(contrasena, Buffer.from(sal, "base64"), Number(logN), Number(r), Number(p));
  // Comparación en tiempo constante: no revela cuántos bytes coinciden
  return calculado.length === esperado.length && timingSafeEqual(calculado, esperado);
}

// Si el email no existe, comparamos igualmente contra un hash ficticio para
// que la respuesta tarde lo mismo y no delate qué emails están registrados.
let hashFicticio: Promise<string> | undefined;
export function hashParaIgualarTiempos(): Promise<string> {
  hashFicticio ??= cifrarContrasena("contraseña-ficticia-para-igualar-tiempos");
  return hashFicticio;
}
