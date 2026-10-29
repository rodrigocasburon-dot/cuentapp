// GET /documentos/exportar?anio=2026&trimestre=3
// Descarga el Excel contable del trimestre para el gestor (RF-09).
// Aislamiento: la empresa sale siempre de la sesión (repositorioActual).

import { repositorioActual } from "@/servidor/auth/sesion";
import { generarExcelTrimestre } from "@/servidor/documentos/excel";

export async function GET(peticion: Request) {
  const { sesion, repo } = await repositorioActual();
  const url = new URL(peticion.url);

  const anioParam = Number(url.searchParams.get("anio"));
  const trimParam = Number(url.searchParams.get("trimestre"));

  const anio = anioParam >= 2000 && anioParam <= 2100 ? anioParam : new Date().getFullYear();
  const trimestre = trimParam >= 1 && trimParam <= 4 ? trimParam : Math.ceil((new Date().getMonth() + 1) / 3);

  const docs = repo.documentosDelTrimestre(anio, trimestre);
  const semaforo = repo.resumenTrimestre(anio, trimestre);

  const buffer = await generarExcelTrimestre({
    empresa: {
      nombre: sesion.empresa.nombre,
      nif: repo.nifEmpresa(),
    },
    anio,
    trimestre,
    semaforo,
    documentos: docs,
  });

  const nombreLimpio = sesion.empresa.nombre.toLowerCase().replace(/[^a-z0-9]/g, "_") || "empresa";
  const nombreFichero = `cuentapp-${nombreLimpio}-${anio}-T${trimestre}.xlsx`;

  return new Response(buffer as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nombreFichero}"`,
      "Cache-Control": "private, no-cache, no-store",
    },
  });
}
