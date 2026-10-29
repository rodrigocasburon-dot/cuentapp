// Aislamiento entre empresas. UN FALLO AQUÍ BLOQUEA LA ENTREGA.
// Se ampliará en cada fase con cada nueva función del repositorio.

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { crearEmpresaConTitular, crearSesion, leerSesion } from "@/servidor/bd/cuentas";
import { repositorioDeEmpresa } from "@/servidor/bd/repositorio";
import { bdDePrueba, ORIGINAL } from "./ayudas";

/** Todos los .ts/.tsx de una carpeta, recursivamente. */
function ficheros(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const ruta = path.join(dir, e.name);
    return e.isDirectory() ? ficheros(ruta) : /\.(ts|tsx)$/.test(e.name) ? [ruta] : [];
  });
}
const SRC = path.resolve(__dirname, "..", "src");

describe("aislamiento por empresa (sesión → repositorio)", () => {
  it("con la sesión de A solo se llega a los datos de A, y viceversa", () => {
    const bd = bdDePrueba();
    const registro = (email: string) => ({ empresa: email, nif: null, nombre: "X", email, hashContrasena: "x" });
    const a = crearEmpresaConTitular(bd, registro("a@a.es"));
    const b = crearEmpresaConTitular(bd, registro("b@b.es"));
    const sesionA = leerSesion(bd, crearSesion(bd, a.usuarioId, a.empresaId).token)!;
    const sesionB = leerSesion(bd, crearSesion(bd, b.usuarioId, b.empresaId).token)!;

    const repoA = repositorioDeEmpresa(bd, sesionA.empresa.id);
    const repoB = repositorioDeEmpresa(bd, sesionB.empresa.id);
    const idA = repoA.crearDocumento(ORIGINAL);

    expect(repoA.listarDocumentos().map((d) => d.id)).toEqual([idA]);
    expect(repoB.listarDocumentos()).toEqual([]);
    expect(repoB.obtenerDocumento(idA)).toBeUndefined();
  });
});

describe("las páginas no se saltan la sesión", () => {
  // Las páginas y acciones (src/app) obtienen los datos con repositorioActual(),
  // que saca la empresa de la sesión. Si importan el repositorio directamente,
  // podrían usar una empresa que venga del navegador.
  it("src/app no importa el repositorio ni lo construye a mano", () => {
    const infractores = ficheros(path.join(SRC, "app")).filter((f) => /repositorio"|repositorioDeEmpresa/.test(fs.readFileSync(f, "utf8")));
    expect(infractores.map((f) => path.relative(SRC, f))).toEqual([]);
  });

  it("los componentes de cliente no importan código de servidor", () => {
    const infractores = ficheros(SRC).filter((f) => {
      const t = fs.readFileSync(f, "utf8");
      return /^["']use client["']/m.test(t) && /@\/servidor\//.test(t);
    });
    expect(infractores.map((f) => path.relative(SRC, f))).toEqual([]);
  });
});

describe("aislamiento por empresa (repositorio)", () => {
  it("B no ve, no lee y no modifica los documentos de A", () => {
    const bd = bdDePrueba();
    const a = repositorioDeEmpresa(bd, "A");
    const b = repositorioDeEmpresa(bd, "B");
    const id = a.crearDocumento(ORIGINAL);

    expect(a.listarDocumentos()).toHaveLength(1);
    expect(b.listarDocumentos()).toHaveLength(0);
    expect(b.obtenerDocumento(id)).toBeUndefined();
    expect(b.buscarPorHash(ORIGINAL.hash_sha256)).toHaveLength(0);
    expect(b.cambiarEstado(id, "incidencia")).toBe(false);
    expect(a.obtenerDocumento(id)?.estado).toBe("recibido");
  });

  it("sin empresa no hay acceso", () => {
    const bd = bdDePrueba();
    expect(() => repositorioDeEmpresa(bd, "")).toThrow();
  });
});

describe("aislamiento por empresa (base de datos)", () => {
  it("una incidencia, línea o corrección no puede apuntar a un documento de otra empresa", () => {
    const bd = bdDePrueba();
    const id = repositorioDeEmpresa(bd, "A").crearDocumento(ORIGINAL);
    expect(() =>
      bd.prepare("INSERT INTO incidencias (id, empresa_id, documento_id, tipo, bloqueante, descripcion) VALUES ('i1', 'B', ?, 'duplicado', 1, 'x')").run(id),
    ).toThrow(/empresa/);
    expect(() =>
      bd.prepare("INSERT INTO lineas_iva (id, empresa_id, documento_id, tipo_iva, base_centimos, cuota_centimos) VALUES ('l1', 'B', ?, 21, 100, 21)").run(id),
    ).toThrow(/empresa/);
    expect(() =>
      bd.prepare("INSERT INTO correcciones (id, empresa_id, documento_id, campo, usuario_id) VALUES ('c1', 'B', ?, 'total', 'uA')").run(id),
    ).toThrow(/empresa/);
  });

  it("un documento no puede asignarse a un periodo de otra empresa", () => {
    const bd = bdDePrueba();
    bd.prepare("INSERT INTO periodos (id, empresa_id, anio, trimestre) VALUES ('pB', 'B', 2026, 3)").run();
    const id = repositorioDeEmpresa(bd, "A").crearDocumento(ORIGINAL);
    expect(() => bd.prepare("UPDATE documentos SET periodo_id = 'pB' WHERE id = ?").run(id)).toThrow(/periodo/);
  });
});

describe("nadie se salta el repositorio", () => {
  // Busca SQL "a pelo" fuera de src/servidor/bd. Si esta prueba falla, mueve
  // la consulta al repositorio (con su filtro por empresa) en vez de silenciarla.
  it("solo src/servidor/bd ejecuta SQL", () => {
    const raiz = path.resolve(__dirname, "..", "src");
    const permitida = path.join(raiz, "servidor", "bd");
    const infractores: string[] = [];
    const recorrer = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const ruta = path.join(dir, e.name);
        if (e.isDirectory()) recorrer(ruta);
        else if (/\.(ts|tsx)$/.test(e.name) && !ruta.startsWith(permitida)) {
          const texto = fs.readFileSync(ruta, "utf8");
          if (/better-sqlite3|\.prepare\(|\.exec\(\s*["'`]/.test(texto)) infractores.push(path.relative(raiz, ruta));
        }
      }
    };
    recorrer(raiz);
    expect(infractores).toEqual([]);
  });
});
