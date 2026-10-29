// Papelera, acciones sobre varios documentos, datos de la empresa y baja (D-41, D-42).

import { describe, expect, it } from "vitest";
import { repositorioDeEmpresa } from "@/servidor/bd/repositorio";
import { buscarCredenciales, cambiarNombreUsuario, crearSesion, darDeBaja, leerSesion } from "@/servidor/bd/cuentas";
import { bdDePrueba, ORIGINAL } from "./ayudas";

const HOY = new Date("2026-10-29T10:00:00Z");

describe("papelera (D-41)", () => {
  it("mover a la papelera saca el documento de la lista y del trimestre, y se puede recuperar", () => {
    const bd = bdDePrueba();
    const repo = repositorioDeEmpresa(bd, "A");
    const id = repo.crearDocumento(ORIGINAL, HOY);
    repo.corregirDocumento(id, "uA", { fecha_emision: "2026-08-19", total_centimos: 500 }, HOY);
    expect(repo.documentosDelTrimestre(2026, 3)).toHaveLength(1);

    expect(repo.moverAPapelera(id, "uA", HOY)).toBe(true);
    expect(repo.listarDocumentos()).toHaveLength(0);
    expect(repo.listarDocumentos({ papelera: true }).map((d) => d.id)).toEqual([id]);
    expect(repo.documentosDelTrimestre(2026, 3)).toHaveLength(0);
    expect(() => repo.validarDocumento(id, "uA", HOY)).toThrow(/descartado/);

    expect(repo.recuperarDePapelera(id)).toBe(true);
    expect(repo.listarDocumentos()).toHaveLength(1);
    expect(repo.obtenerDocumento(id)?.descartado_en).toBeNull();
  });

  it("no borra nada: la fila sigue en la base de datos", () => {
    const bd = bdDePrueba();
    const repo = repositorioDeEmpresa(bd, "A");
    const id = repo.crearDocumento(ORIGINAL, HOY);
    repo.moverAPapelera(id, "uA", HOY);
    expect(repo.obtenerDocumento(id)).toMatchObject({ id, hash_sha256: ORIGINAL.hash_sha256 });
  });

  it("una empresa no puede mover ni recuperar documentos de otra", () => {
    const bd = bdDePrueba();
    const idB = repositorioDeEmpresa(bd, "B").crearDocumento(ORIGINAL, HOY);
    const repoA = repositorioDeEmpresa(bd, "A");
    expect(repoA.moverAPapelera(idB, "uA", HOY)).toBe(false);
    repositorioDeEmpresa(bd, "B").moverAPapelera(idB, "uA", HOY);
    expect(repoA.recuperarDePapelera(idB)).toBe(false);
    expect(repositorioDeEmpresa(bd, "B").obtenerDocumento(idB)?.descartado_en).not.toBeNull();
  });
});

describe("incidencias abiertas por documento (columna «A revisar»)", () => {
  it("devuelve solo las abiertas y solo de esta empresa", () => {
    const bd = bdDePrueba();
    const repoA = repositorioDeEmpresa(bd, "A");
    const repoB = repositorioDeEmpresa(bd, "B");
    const a1 = repoA.crearDocumento(ORIGINAL, HOY);
    const a2 = repoA.crearDocumento({ ...ORIGINAL, hash_sha256: "b".repeat(64) }, HOY);
    const b1 = repoB.crearDocumento(ORIGINAL, HOY);
    repoA.crearIncidencia({ documentoId: a2, tipo: "duplicado", bloqueante: 1, descripcion: "x", documentoReferenciaId: a1 });
    const resuelta = repoA.crearIncidencia({ documentoId: a1, tipo: "ilegible", bloqueante: 1, descripcion: "x" });
    repoA.resolverIncidencia(resuelta, "no_duplicado", "uA", HOY);
    repoB.crearIncidencia({ documentoId: b1, tipo: "ilegible", bloqueante: 1, descripcion: "x" });

    expect([...repoA.incidenciasAbiertasPorDocumento()]).toEqual([[a2, ["duplicado"]]]);
  });
});

describe("datos de la empresa y del usuario", () => {
  it("cada empresa solo cambia sus propios datos", () => {
    const bd = bdDePrueba();
    repositorioDeEmpresa(bd, "A").cambiarDatosEmpresa("Nueva A S.L.", "B00000000");
    expect(bd.prepare("SELECT nombre, nif FROM empresas ORDER BY id").all()).toEqual([
      { nombre: "Nueva A S.L.", nif: "B00000000" },
      { nombre: "Empresa B", nif: null },
    ]);
    cambiarNombreUsuario(bd, "uA", "Ana Nueva");
    expect(bd.prepare("SELECT nombre FROM usuarios WHERE id = 'uA'").get()).toEqual({ nombre: "Ana Nueva" });
  });
});

describe("baja de la cuenta (D-42)", () => {
  it("cierra las sesiones, impide volver a entrar y conserva los documentos", () => {
    const bd = bdDePrueba();
    bd.prepare("INSERT INTO membresias (usuario_id, empresa_id, rol) VALUES ('uA', 'A', 'titular')").run();
    const id = repositorioDeEmpresa(bd, "A").crearDocumento(ORIGINAL, HOY);
    const { token } = crearSesion(bd, "uA", "A", HOY);
    expect(leerSesion(bd, token, HOY)).not.toBeNull();

    darDeBaja(bd, "uA", "A", HOY);
    expect(leerSesion(bd, token, HOY)).toBeNull();
    expect(buscarCredenciales(bd, "a@a.local")).toBeUndefined();
    expect(() => crearSesion(bd, "uA", "A", HOY)).not.toThrow(); // aunque se crease una sesión...
    expect(bd.prepare("SELECT count(*) n FROM sesiones").get()).toEqual({ n: 1 });
    const nueva = crearSesion(bd, "uA", "A", HOY);
    expect(leerSesion(bd, nueva.token, HOY)).toBeNull(); // ...no sirve para entrar
    expect(repositorioDeEmpresa(bd, "A").obtenerDocumento(id)).toBeDefined();
  });

  it("solo el titular puede dar de baja la empresa", () => {
    const bd = bdDePrueba();
    bd.prepare("INSERT INTO membresias (usuario_id, empresa_id, rol) VALUES ('uA', 'A', 'miembro')").run();
    expect(() => darDeBaja(bd, "uA", "A", HOY)).toThrow(/titular/);
    expect(() => darDeBaja(bd, "uA", "B", HOY)).toThrow(/titular/);
  });
});
