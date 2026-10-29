import { describe, expect, it } from "vitest";
import { nifValido, normalizarNif, tipoNif } from "@/dominio/nif";

describe("validación de NIF/CIF/NIE", () => {
  it("reconoce identificadores válidos", () => {
    expect(nifValido("12345678Z")).toBe(true); // DNI
    expect(nifValido("X1234567L")).toBe(true); // NIE
    expect(nifValido("B00000000")).toBe(true); // CIF con control numérico
    expect(nifValido("b-11.111.119")).toBe(true); // con formato "humano"
  });

  it("rechaza dígitos de control erróneos y formatos raros", () => {
    expect(nifValido("12345678A")).toBe(false);
    expect(nifValido("B00000001")).toBe(false);
    expect(nifValido("1234")).toBe(false);
    expect(nifValido("")).toBe(false);
  });

  it("normaliza y clasifica", () => {
    expect(normalizarNif(" b 12.345.678 ")).toBe("B12345678");
    expect(tipoNif("12345678Z")).toBe("dni");
    expect(tipoNif("Y0000000Z")).toBe("nie");
    expect(tipoNif("Q2826000H")).toBe("cif");
  });
});
