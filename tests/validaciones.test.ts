// Validaciones deterministas (RF-05). Se contrastan con lo que el banco
// sintético dice que debe detectarse en cada documento.

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { nivelMaximo, validar } from "@/dominio/validaciones";
import { extraccionVacia, type Extraccion, type LineaIva } from "@/lectura/esquema";

const HOY = new Date("2026-10-29T10:00:00Z");
const CARPETA = path.resolve(__dirname, "..", "banco-tickets", "sinteticos");

/** Una Extraccion "perfecta" (lo que leería un lector sin errores) a partir de la verdad. */
function extraccionDe(v: Record<string, unknown>, confianza = 0.9): Extraccion {
  const c = <T>(valor: T) => ({ valor, confianza: valor === null ? 0 : confianza });
  return {
    tipo: c(v.tipo as Extraccion["tipo"]["valor"]),
    nombre_emisor: c(v.nombre_emisor as string | null),
    nif_emisor: c(v.nif_emisor as string | null),
    nif_receptor: c(v.nif_receptor as string | null),
    numero: c(v.numero as string | null),
    fecha_emision: c(v.fecha_emision as string | null),
    moneda: c(v.moneda as string),
    total_centimos: c(v.total_centimos as number),
    lineas_iva: { valor: v.lineas_iva as LineaIva[], confianza },
  };
}

describe("validaciones frente al banco sintético", () => {
  const casos = fs
    .readdirSync(CARPETA)
    .filter((f) => f.endsWith(".json") && f !== "indice.json")
    .map((f) => JSON.parse(fs.readFileSync(path.join(CARPETA, f), "utf8")))
    // El ilegible y el duplicado no se detectan con los datos, sino con la lectura y el hash
    .filter((v) => v.degradacion !== "ilegible" && !v.copia_de);

  it.each(casos.map((v) => [v.id, v]))("%s", (_id, v) => {
    const avisos = validar(extraccionDe(v), HOY);
    const codigos = avisos.filter((a) => a.nivel !== "info").map((a) => a.codigo);
    for (const esperado of v.esperado.validaciones) expect(codigos).toContain(esperado);
    // Semáforo esperado del banco: verde = sin ámbar ni rojo
    const nivel = nivelMaximo(avisos.filter((a) => a.nivel !== "info"));
    expect(nivel ?? "verde").toBe(v.esperado.semaforo === "ambar" ? "ambar" : v.esperado.semaforo === "rojo" ? "rojo" : "verde");
  });
});

describe("casos concretos", () => {
  const base = () =>
    extraccionDe({
      tipo: "ticket_simplificado", nombre_emisor: "Bar", nif_emisor: "B00000000", nif_receptor: null, numero: "1",
      fecha_emision: "2026-10-01", moneda: "EUR", total_centimos: 121, lineas_iva: [{ tipo_iva: 21, base_centimos: 100, cuota_centimos: 21 }],
    });

  it("un ticket correcto solo lleva el aviso informativo de NIF de receptor", () => {
    expect(validar(base(), HOY).map((a) => [a.codigo, a.nivel])).toEqual([["ticket_sin_nif_receptor", "info"]]);
  });

  it("casi nada leído = ilegible (rojo) y no se valida nada más", () => {
    const ex = extraccionVacia();
    ex.moneda = { valor: "EUR", confianza: 0.2 };
    ex.total_centimos = { valor: 300, confianza: 0.2 };
    expect(validar(ex, HOY)).toEqual([expect.objectContaining({ codigo: "ilegible", nivel: "rojo" })]);
  });

  it("detecta cuota que no corresponde a la base y tipo de IVA no español", () => {
    const ex = base();
    ex.lineas_iva.valor = [{ tipo_iva: 20, base_centimos: 100, cuota_centimos: 25 }];
    ex.total_centimos.valor = 125;
    const codigos = validar(ex, HOY).map((a) => a.codigo);
    expect(codigos).toEqual(expect.arrayContaining(["cuota_incorrecta", "tipo_iva_no_espanol"]));
  });

  it("tolera 1 céntimo de redondeo por línea de IVA", () => {
    const ex = base();
    ex.total_centimos.valor = 122;
    expect(validar(ex, HOY).map((a) => a.codigo)).not.toContain("descuadre_total");
    ex.total_centimos.valor = 123;
    expect(validar(ex, HOY).map((a) => a.codigo)).toContain("descuadre_total");
  });

  it("fechas futuras o de hace más de 4 años no son plausibles", () => {
    for (const f of ["2026-10-30", "2021-12-31"]) {
      const ex = base();
      ex.fecha_emision.valor = f;
      expect(validar(ex, HOY).map((a) => a.codigo)).toContain("fecha_no_plausible");
    }
  });

  it("marca como dudosos los campos leídos con poca confianza", () => {
    const ex = base();
    ex.numero.confianza = 0.4;
    expect(validar(ex, HOY)).toContainEqual(expect.objectContaining({ codigo: "campo_dudoso", campo: "numero", nivel: "ambar" }));
  });

  it("documento a nombre de otra empresa: rojo si el NIF es válido y seguro, ámbar si es dudoso", () => {
    const ex = base();
    ex.nif_receptor = { valor: "B11111119", confianza: 0.9 };
    expect(validar(ex, HOY, { nifEmpresa: "B00000000" })).toContainEqual(expect.objectContaining({ codigo: "receptor_ajeno", nivel: "rojo" }));
    ex.nif_receptor.confianza = 0.5;
    expect(validar(ex, HOY, { nifEmpresa: "B00000000" })).toContainEqual(expect.objectContaining({ codigo: "receptor_ajeno", nivel: "ambar" }));
    ex.nif_receptor = { valor: "b-00.000.000", confianza: 0.9 }; // el mismo NIF escrito de otra forma
    expect(validar(ex, HOY, { nifEmpresa: "B00000000" }).map((a) => a.codigo)).not.toContain("receptor_ajeno");
    expect(validar(ex, HOY, { nifEmpresa: null }).map((a) => a.codigo)).not.toContain("receptor_ajeno"); // empresa sin NIF: no se puede comprobar
  });

  it("moneda desconocida es ámbar; moneda extranjera conocida es solo informativa", () => {
    const ex = base();
    ex.moneda.valor = "XYZ";
    expect(validar(ex, HOY)).toContainEqual(expect.objectContaining({ codigo: "moneda_desconocida", nivel: "ambar" }));
    ex.moneda.valor = "USD";
    expect(validar(ex, HOY)).toContainEqual(expect.objectContaining({ codigo: "moneda_extranjera", nivel: "info" }));
  });
});
