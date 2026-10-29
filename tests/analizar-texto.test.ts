// Analizador de texto OCR. Los textos son salidas REALES de los motores A y B
// sobre el banco sintético (comparativa del 29/10/2026), con sus errores.

import { describe, expect, it } from "vitest";
import { aCentimos, aFechaIso, analizarTexto, importesDe } from "@/lectura/analizar-texto";
import { ExtraccionSchema } from "@/lectura/esquema";

describe("utilidades", () => {
  it("convierte importes a céntimos", () => {
    expect(aCentimos("1.250,00")).toBe(125000);
    expect(aCentimos("1250,00")).toBe(125000);
    expect(aCentimos("12.50")).toBe(1250);
    expect(aCentimos("-3,10")).toBe(-310);
    expect(aCentimos("abc")).toBeNull();
  });

  it("no inventa importes en números raros", () => {
    expect(importesDe("TOTAL € 20,072")).toEqual([]); // lectura errónea del OCR: mejor vacío
    expect(importesDe("Gasóleo A 31,25 L x 1,600")).toEqual([3125]);
  });

  it("valida fechas reales", () => {
    expect(aFechaIso("Fecha: 14/07/2026 13:42")).toBe("2026-07-14");
    expect(aFechaIso("2026-07-14")).toBe("2026-07-14");
    expect(aFechaIso("31/02/2026")).toBeNull();
  });
});

describe("analizarTexto", () => {
  it("ticket leído por Tesseract ('Nº' leído como 'Ne')", () => {
    const ex = analizarTexto(
      `Cafetería La Taza Inventada
C/ Imaginaria 12, 28000 Madrid
NIF: B44173813
FACTURA SIMPLIFICADA
Ne: T-000231
Fecha: 14/07/2026 13:42
2 Café con leche 2,60
1 Tostada 1,10
TOTAL € 3,70
BASE CUOTA
IVA 10% 3,36 0,34`,
      0.9,
    );
    expect(ExtraccionSchema.parse(ex)).toBeTruthy();
    expect(ex.tipo.valor).toBe("ticket_simplificado");
    expect(ex.nombre_emisor.valor).toBe("Cafetería La Taza Inventada");
    expect(ex.nif_emisor.valor).toBe("B44173813");
    expect(ex.nif_receptor.valor).toBeNull();
    expect(ex.numero.valor).toBe("T-000231");
    expect(ex.fecha_emision.valor).toBe("2026-07-14");
    expect(ex.moneda.valor).toBe("EUR");
    expect(ex.total_centimos.valor).toBe(370);
    expect(ex.lineas_iva.valor).toEqual([{ tipo_iva: 10, base_centimos: 336, cuota_centimos: 34 }]);
    expect(ex.total_centimos.confianza).toBeGreaterThan(0.8); // cuadra con el IVA
  });

  it("factura con columnas mezcladas: el número de factura no se confunde con el NIF", () => {
    const ex = analizarTexto(`Asesores de Mentira S.L. FACTURA
Pza. Ficción 1, 08000 Barcelona 'N? F2026-0187
NIF: B61200754 Fecha: 31/07/2026
Cliente
Panadería Ejemplo S.L.
NIF: B00000000
Base imponible 1250,00€
IVA 21% sobre 1250,00 262,50€
TOTAL 1512,50€`);
    expect(ex.tipo.valor).toBe("factura_completa");
    expect(ex.nombre_emisor.valor).toBe("Asesores de Mentira S.L.");
    expect(ex.nif_emisor.valor).toBe("B61200754");
    expect(ex.nif_receptor.valor).toBe("B00000000");
    expect(ex.numero.valor).toBe("F2026-0187");
    expect(ex.total_centimos.valor).toBe(151250);
    expect(ex.lineas_iva.valor).toEqual([{ tipo_iva: 21, base_centimos: 125000, cuota_centimos: 26250 }]);
  });

  it("foto inclinada: el importe del total cae en la línea de al lado (RapidOCR)", () => {
    const ex = analizarTexto(`Restaurante El Plato Ficticio
NIF：B90451261
FACTURA SIMPLIFICADA
Nº:M12-00877
20,02
Menú del día x2
20,02
TOTAL €
BASE CUOTA
IVA 10% 18,20 1,82`);
    expect(ex.nif_emisor.valor).toBe("B90451261"); // ":" de ancho completo
    expect(ex.numero.valor).toBe("M12-00877");
    expect(ex.total_centimos.valor).toBe(2002);
  });

  it("texto vacío o basura: nada inventado y confianza 0", () => {
    for (const texto of ["", "~~~ ::: ..."]) {
      const ex = analizarTexto(texto, 0.2);
      expect(ex.total_centimos.valor).toBeNull();
      expect(ex.nif_emisor.valor).toBeNull();
    }
  });

  it("la confianza del OCR limita la de cada campo", () => {
    const ex = analizarTexto("NIF: B44173813\nTOTAL 3,70", 0.3);
    expect(ex.nif_emisor.confianza).toBeLessThanOrEqual(0.3);
  });
});
