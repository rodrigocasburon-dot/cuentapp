// Utilidades compartidas por las pruebas: una base de datos en memoria
// con el esquema real, los planes y dos empresas.

import { abrirBd, aplicarEsquema, insertarPlanes, type Bd } from "@/servidor/bd/conexion";

export function bdDePrueba(): Bd {
  const bd = abrirBd(":memory:");
  aplicarEsquema(bd);
  insertarPlanes(bd);
  const ins = bd.prepare("INSERT INTO empresas (id, nombre, plan_id, buzon) VALUES (?, ?, 'cuentapp', ?)");
  ins.run("A", "Empresa A", "a@buzon.local");
  ins.run("B", "Empresa B", "b@buzon.local");
  bd.prepare("INSERT INTO usuarios (id, email, hash_contrasena, nombre) VALUES ('uA', 'a@a.local', 'x', 'Usuaria A')").run();
  return bd;
}

export const ORIGINAL = {
  origen: "subida" as const,
  nombre_original: "ticket.png",
  mime: "image/png",
  tamano_bytes: 1234,
  ruta_original: "A/ab.png",
  hash_sha256: "a".repeat(64),
};
