// Correo saliente (recuperación de contraseña, D-57).
//
// MVP LOCAL: no se envía nada. Cada correo se guarda como un .txt en
// datos/correos-salientes/ (fuera de git) y se avisa en la consola del
// servidor; quien ejecuta la app abre el fichero y sigue el enlace.
// PRODUCCIÓN: un proveedor de correo transaccional (SMTP o API) con SPF, DKIM
// y DMARC. No está implementado (ver SUPUESTOS.md, MVP local frente a producción).

import fs from "node:fs";
import path from "node:path";
import { CARPETA_CORREOS } from "@/config";

export interface Correo {
  para: string;
  asunto: string;
  texto: string;
}

/** Guarda el correo y devuelve la ruta del fichero (para las pruebas). */
export function enviarCorreo(c: Correo, carpeta = CARPETA_CORREOS, ahora = new Date()): string {
  fs.mkdirSync(carpeta, { recursive: true });
  // Nombre sin datos del destinatario: fecha + sufijo aleatorio
  const nombre = `${ahora.toISOString().replace(/[:.]/g, "-")}-${Math.random().toString(36).slice(2, 8)}.txt`;
  const ruta = path.join(carpeta, nombre);
  fs.writeFileSync(ruta, `Para: ${c.para}\nAsunto: ${c.asunto}\n\n${c.texto}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
  console.info(`[correo simulado] «${c.asunto}» guardado en ${path.relative(process.cwd(), ruta)}`);
  return ruta;
}
