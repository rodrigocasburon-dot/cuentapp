// GET /documentos/<id>/original[?descargar=1]
// Las rutas no pasan por el layout privado: la sesión se exige aquí, en repositorioActual().

import { repositorioActual } from "@/servidor/auth/sesion";
import { respuestaOriginal } from "@/servidor/documentos/servir-original";

export async function GET(peticion: Request, { params }: { params: Promise<{ id: string }> }) {
  const { repo } = await repositorioActual();
  const { id } = await params;
  const descargar = new URL(peticion.url).searchParams.get("descargar") === "1";
  const r = respuestaOriginal(repo, id, descargar);
  return new Response(r.cuerpo as BodyInit, { status: r.estado, headers: r.cabeceras });
}
