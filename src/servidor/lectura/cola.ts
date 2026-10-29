// Arranque de la cola de lectura desde la app. Como mucho una ejecución a la
// vez por proceso de Node: si ya hay una en marcha, no se lanza otra (la que
// está en marcha recogerá también los documentos nuevos).

import { bd } from "@/servidor/bd/conexion";
import { extractInvoice } from "./extraer";
import { procesarPendientes } from "./procesar";
import { tipoDeCambio } from "./tipo-cambio";

const g = globalThis as unknown as { __cuentappColaActiva?: boolean; __cuentappColaOtraVez?: boolean };

export function lanzarCola(): void {
  if (g.__cuentappColaActiva) {
    g.__cuentappColaOtraVez = true; // al terminar, volverá a mirar
    return;
  }
  g.__cuentappColaActiva = true;
  void (async () => {
    try {
      do {
        g.__cuentappColaOtraVez = false;
        await procesarPendientes(bd(), {
          extraer: extractInvoice,
          cambio: (moneda, fecha) => tipoDeCambio(bd(), moneda, fecha),
        });
      } while (g.__cuentappColaOtraVez);
    } catch (e) {
      console.error("[cola de lectura]", e);
    } finally {
      g.__cuentappColaActiva = false;
    }
  })();
}
