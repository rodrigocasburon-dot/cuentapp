import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EstadoDocumento } from "@/componentes/EstadoDocumento";
import { Refresco } from "@/componentes/Refresco";
import { fechaHora, tamano } from "@/dominio/formato";
import type { Aviso } from "@/dominio/validaciones";
import { repositorioActual } from "@/servidor/auth/sesion";
import { originalIntegro } from "@/servidor/documentos/servir-original";
import { FormFichaDocumento } from "./FormFichaDocumento";

export const metadata: Metadata = { title: "Documento · Cuentapp" };

export default async function FichaDocumento({ params }: { params: Promise<{ id: string }> }) {
  const { repo } = await repositorioActual();
  const { id } = await params;
  const doc = repo.obtenerDocumento(id);
  if (!doc) notFound(); // tampoco si es de otra empresa

  const integro = originalIntegro(doc.ruta_original, doc.hash_sha256);
  const urlOriginal = `/documentos/${doc.id}/original`;
  const esSvg = doc.mime === "image/svg+xml"; // solo descarga (D-40)
  const leyendo = doc.estado === "recibido" || doc.estado === "procesando";
  const confianza: Record<string, number> = doc.confianza_json ? JSON.parse(doc.confianza_json) : {};
  const avisos: Aviso[] = doc.avisos_json ? JSON.parse(doc.avisos_json) : [];
  const lineas = repo.lineasIva(doc.id);
  const incidencias = repo.incidencias(doc.id);
  const correcciones = repo.listarCorrecciones(doc.id);

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <Refresco activo={leyendo} />
      <p className="mb-4">
        <Link href="/documentos" className="underline underline-offset-4">
          ← Documentos
        </Link>
      </p>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="break-words text-3xl font-black tracking-tight">{doc.nombre_original}</h1>
        <div className="flex items-center gap-3">
          <EstadoDocumento estado={doc.estado} />
          {doc.descartado_en && (
            <span className="rounded-full bg-rojo px-3 py-1 text-sm font-bold text-crema">
              <span aria-hidden="true">⛔ </span>Descartado
            </span>
          )}
        </div>
      </div>

      <div className="mt-8 grid gap-10 lg:grid-cols-2">
        <div>
          {leyendo ? (
            <p role="status" className="rounded-2xl bg-crema-2 p-5 font-semibold">
              <span aria-hidden="true">⟳ </span>Leyendo el documento… esta página se actualiza sola.
            </p>
          ) : (
            <FormFichaDocumento
              documento={doc}
              confianza={confianza}
              avisos={avisos}
              incidencias={incidencias}
              lineasIniciales={lineas}
              correcciones={correcciones}
            />
          )}

          <section aria-labelledby="original" className="mt-10 rounded-2xl border-2 border-crema-2 bg-white p-5">
            <h2 id="original" className="mb-3 text-xl font-bold">
              Original
            </h2>
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[max-content_1fr]">
              <dt className="font-semibold">Recibido</dt>
              <dd>
                {fechaHora(doc.creado_en)} · {doc.origen === "buzon" ? "por el buzón" : "subido a mano"}
              </dd>
              <dt className="font-semibold">Formato</dt>
              <dd>
                {doc.mime} · {tamano(doc.tamano_bytes)}
              </dd>
              <dt className="font-semibold">Huella SHA-256</dt>
              <dd className="break-all font-mono text-xs">{doc.hash_sha256}</dd>
              <dt className="font-semibold">Integridad</dt>
              <dd className={integro ? "" : "font-semibold text-rojo"}>
                <span aria-hidden="true">{integro ? "✔ " : "⚠ "}</span>
                {integro ? "Intacto: coincide con su huella." : "No coincide con su huella o no se encuentra. Avisa al equipo."}
              </dd>
            </dl>
            <div className="mt-4 flex flex-wrap gap-3">
              {!esSvg && (
              <a
                href={urlOriginal}
                target="_blank"
                rel="noopener"
                className="rounded-full bg-marron-oscuro px-5 py-2 font-bold text-crema hover:bg-marron"
              >
                Abrir el original
              </a>
              )}
              <a
                href={`${urlOriginal}?descargar=1`}
                className="rounded-full border-2 border-marron-oscuro px-5 py-2 font-bold hover:bg-crema-2"
              >
                Descargar
              </a>
            </div>
          </section>
        </div>

        <div className="space-y-6">
          {integro && esSvg && (
            <div className="sticky top-6 rounded-2xl border-2 border-crema-2 bg-crema-2 p-6 text-center">
              <p className="font-bold">Documento SVG</p>
              <p className="mt-1 text-sm text-marron">
                Por seguridad, los SVG no se muestran en la web: descárgalo para verlo. Tampoco se leen solos; escribe los datos a mano.
              </p>
            </div>
          )}
          {integro && doc.mime.startsWith("image/") && !esSvg && (
            // eslint-disable-next-line @next/next/no-img-element -- el original se sirve tal cual, sin optimizar
            <img
              src={urlOriginal}
              alt={`Vista del original: ${doc.nombre_original}`}
              className="sticky top-6 max-h-[85vh] w-full rounded-2xl border-2 border-crema-2 object-contain bg-white"
            />
          )}
          {integro && doc.mime === "application/pdf" && (
            <div className="sticky top-6 rounded-2xl border-2 border-crema-2 bg-crema-2 p-6 text-center">
              <p className="font-bold">Documento PDF</p>
              <p className="mt-1 text-sm text-marron">Puedes visualizar o descargar el archivo original para cotejar los datos.</p>
              <div className="mt-4 flex justify-center gap-3">
                <a
                  href={urlOriginal}
                  target="_blank"
                  rel="noopener"
                  className="rounded-full bg-marron-oscuro px-5 py-2 text-sm font-bold text-crema hover:bg-marron"
                >
                  Abrir PDF en pestaña nueva
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
