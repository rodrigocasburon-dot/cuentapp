// Comprueba que la "verdad" del banco sintético es coherente consigo misma.
// Si un caso dice que cuadra, debe cuadrar; si dice que el NIF es erróneo,
// debe serlo. Así, en la fase 2, un fallo será del motor y no del banco.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { nifValido } from "@/dominio/nif";

const CARPETA = path.resolve(__dirname, "..", "banco-tickets", "sinteticos");
const hayBanco = fs.existsSync(path.join(CARPETA, "indice.json"));

interface Verdad {
  id: string;
  tipo: string;
  nif_emisor: string | null;
  nif_receptor: string | null;
  fecha_emision: string;
  lineas_iva: { tipo_iva: number; base_centimos: number; cuota_centimos: number }[];
  total_centimos: number;
  esperado: { validaciones: string[]; semaforo: string; avisos: string[] };
}

const sha = (f: string) => crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex");

describe.skipIf(!hayBanco)("banco de tickets sintético", () => {
  const indice = hayBanco ? (JSON.parse(fs.readFileSync(path.join(CARPETA, "indice.json"), "utf8")) as { id: string }[]) : [];

  it("tiene al menos 10 casos con imagen y verdad", () => {
    expect(indice.length).toBeGreaterThanOrEqual(10);
    for (const { id } of indice) {
      expect(fs.statSync(path.join(CARPETA, `${id}.png`)).size).toBeGreaterThan(5000);
      expect(fs.existsSync(path.join(CARPETA, `${id}.json`))).toBe(true);
    }
  });

  it.each(indice.map((i) => i.id))("%s: la verdad es coherente", (id) => {
    const v = JSON.parse(fs.readFileSync(path.join(CARPETA, `${id}.json`), "utf8")) as Verdad;
    const suma = v.lineas_iva.reduce((s, l) => s + l.base_centimos + l.cuota_centimos, 0);
    const descuadre = v.esperado.validaciones.includes("descuadre_total");
    expect(suma !== v.total_centimos).toBe(descuadre);

    for (const l of v.lineas_iva) {
      expect(Math.abs(l.cuota_centimos - (l.base_centimos * l.tipo_iva) / 100)).toBeLessThanOrEqual(0.5);
    }
    if (v.nif_emisor) {
      expect(nifValido(v.nif_emisor)).toBe(!v.esperado.validaciones.includes("nif_emisor_invalido"));
    }
    if (v.tipo === "factura_completa" && !v.nif_receptor) {
      expect(v.esperado.semaforo).not.toBe("verde");
    }
  });

  it("el duplicado es byte a byte igual a su original", () => {
    expect(sha(path.join(CARPETA, "t09-duplicado-t02.png"))).toBe(sha(path.join(CARPETA, "t02-gasolinera.png")));
  });
});
