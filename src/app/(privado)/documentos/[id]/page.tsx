import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EstadoDocumento } from "@/componentes/EstadoDocumento";
import { Refresco } from "@/componentes/Refresco";
import { ETIQUETA_TIPO, type TipoDocumento } from "@/dominio/estados";
import { fecha, fechaHora, importe, tamano } from "@/dominio/formato";
import { CONFIANZA_DUDOSA, type Aviso, type Nivel } from "@/dominio/validaciones";
import { repositorioActual } from "@/servidor/auth/sesion";
import { originalIntegro } from "@/servidor/documentos/servir-original";

export const metadata: Metadata = { title: "Documento · Cuentapp" };

const ICONO_NIVEL: Record<Nivel, string> = { rojo: "✖", ambar: "⚠", info: "ℹ" };
const TEXTO_NIVEL: Record<Nivel, string> = { rojo: "Bloquea", ambar: "Revisar", info: "Aviso" };

/** Valor de un campo con su marca de "dudoso" si la confianza es baja. */
function Valor({ texto, confianza }: { texto: string | null; confianza?: number }) {
  if (texto === null) return <span className="text-marron">No consta</span>;
  const dudoso = confianza !== undefined && confianza < CONFIANZA_DUDOSA;
  return (
    <span>
      {texto}
      {dudoso && (
        <span className="ml-2 rounded-full border-2 border-arena px-2 text-sm font-semibold">
          <span aria-hidden="true">? </span>dudoso
        </span>
      )}
    </span>
  );
}

export default async function FichaDocumento({ params }: { params: Promise<{ id: string }> }) {
  const { repo } = await repositorioActual();
  const { id } = await params;
  const doc = repo.obtenerDocumento(id);
  if (!doc) notFound(); // tampoco si es de otra empresa

  const integro = originalIntegro(doc.ruta_original, doc.hash_sha256);
  const urlOriginal = `/documentos/${doc.id}/original`;
  const leyendo = doc.estado === "recibido" || doc.estado === "procesando";
  const confianza: Record<string, number> = doc.confianza_json ? JSON.parse(doc.confianza_json) : {};
  const avisos: Aviso[] = doc.avisos_json ? JSON.parse(doc.avisos_json) : [];
  const lineas = repo.lineasIva(doc.id);
  const moneda = doc.moneda ?? "EUR";

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <Refresco activo={leyendo} />
      <p className="mb-4">
        <Link href="/documentos" className="underline underline-offset-4">
          ← Documentos
        </Link>
      </p>
      <h1 className="break-words text-3xl font-black tracking-tight">{doc.nombre_original}</h1>
      <div className="mt-3">
        <EstadoDocumento estado={doc.estado} />
      </div>

      <div className="mt-8 grid gap-10 lg:grid-cols-2">
        <div>
          {leyendo ? (
            <p role="status" className="rounded-2xl bg-crema-2 p-5">
              <span aria-hidden="true">⟳ </span>Leyendo el documento… esta página se actualiza sola.
            </p>
          ) : (
            <>
              {avisos.length > 0 && (
                <section aria-labelledby="avisos" className="mb-8">
                  <h2 id="avisos" className="mb-3 text-xl font-bold">Avisos ({avisos.length})</h2>
                  <ul className="space-y-2">
                    {avisos.map((a, i) => (
                      <li key={i} className={`rounded-lg border-2 bg-white px-3 py-2 ${a.nivel === "rojo" ? "border-rojo text-rojo" : a.nivel === "ambar" ? "border-arena" : "border-crema-2"}`}>
                        <span className="font-semibold">
                          <span aria-hidden="true">{ICONO_NIVEL[a.nivel]} </span>
                          {TEXTO_NIVEL[a.nivel]}:
                        </span>{" "}
                        {a.texto}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <section aria-labelledby="datos">
                <h2 id="datos" className="mb-3 text-xl font-bold">Datos leídos</h2>
                <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[max-content_1fr]">
                  <dt className="font-semibold">Tipo</dt>
                  <dd><Valor texto={doc.tipo ? ETIQUETA_TIPO[doc.tipo as TipoDocumento] : null} confianza={confianza.tipo} /></dd>
                  <dt className="font-semibold">Emisor</dt>
                  <dd><Valor texto={doc.nombre_emisor} confianza={confianza.nombre_emisor} /></dd>
                  <dt className="font-semibold">NIF del emisor</dt>
                  <dd><Valor texto={doc.nif_emisor} confianza={confianza.nif_emisor} /></dd>
                  <dt className="font-semibold">NIF del receptor</dt>
                  <dd><Valor texto={doc.nif_receptor} confianza={confianza.nif_receptor} /></dd>
                  <dt className="font-semibold">Número</dt>
                  <dd><Valor texto={doc.numero} confianza={confianza.numero} /></dd>
                  <dt className="font-semibold">Fecha</dt>
                  <dd><Valor texto={doc.fecha_emision ? fecha(doc.fecha_emision) : null} confianza={confianza.fecha_emision} /></dd>
                  <dt className="font-semibold">Total</dt>
                  <dd>
                    <Valor texto={doc.total_centimos !== null ? importe(doc.total_centimos, moneda) : null} confianza={confianza.total_centimos} />
                    {moneda !== "EUR" && doc.total_eur_centimos !== null && (
                      <span className="block text-sm text-marron">
                        = {importe(doc.total_eur_centimos)} (1 € = {doc.tipo_cambio?.toLocaleString("es-ES", { maximumFractionDigits: 6 })} {moneda}, BCE{" "}
                        {doc.fecha_cambio && fecha(doc.fecha_cambio)})
                      </span>
                    )}
                  </dd>
                </dl>

                {lineas.length > 0 && (
                  <table className="mt-6 w-full border-collapse text-left">
                    <caption className="mb-2 text-left font-semibold">Desglose de IVA</caption>
                    <thead>
                      <tr className="border-b-2 border-marron-oscuro">
                        <th scope="col" className="py-1">Tipo</th>
                        <th scope="col" className="py-1 text-right">Base</th>
                        <th scope="col" className="py-1 text-right">Cuota</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lineas.map((l, i) => (
                        <tr key={i} className="border-b border-crema-2">
                          <td className="py-1">{l.tipo_iva} %</td>
                          <td className="py-1 text-right">{importe(l.base_centimos, moneda)}</td>
                          <td className="py-1 text-right">{importe(l.cuota_centimos, moneda)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <p className="mt-4 text-sm text-marron">
                  Leído automáticamente ({doc.motor_lectura}) el {doc.procesado_en && fechaHora(doc.procesado_en)}. La corrección y la validación llegan en la siguiente fase.
                </p>
              </section>
            </>
          )}

          <section aria-labelledby="original" className="mt-10">
            <h2 id="original" className="mb-3 text-xl font-bold">Original</h2>
            <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[max-content_1fr]">
              <dt className="font-semibold">Recibido</dt>
              <dd>{fechaHora(doc.creado_en)} · {doc.origen === "buzon" ? "por el buzón" : "subido a mano"}</dd>
              <dt className="font-semibold">Formato</dt>
              <dd>{doc.mime} · {tamano(doc.tamano_bytes)}</dd>
              <dt className="font-semibold">Huella SHA-256</dt>
              <dd className="break-all font-mono text-sm">{doc.hash_sha256}</dd>
              <dt className="font-semibold">Integridad</dt>
              <dd className={integro ? "" : "font-semibold text-rojo"}>
                <span aria-hidden="true">{integro ? "✔ " : "⚠ "}</span>
                {integro ? "Intacto: coincide con su huella." : "No coincide con su huella o no se encuentra. Avisa al equipo."}
              </dd>
            </dl>
            <div className="mt-4 flex flex-wrap gap-3">
              <a href={urlOriginal} target="_blank" rel="noopener" className="rounded-full bg-marron-oscuro px-5 py-2 font-bold text-crema hover:bg-marron">
                Abrir el original
              </a>
              <a href={`${urlOriginal}?descargar=1`} className="rounded-full border-2 border-marron-oscuro px-5 py-2 font-bold hover:bg-crema-2">
                Descargar
              </a>
            </div>
          </section>
        </div>

        {integro && doc.mime.startsWith("image/") && (
          // eslint-disable-next-line @next/next/no-img-element -- el original se sirve tal cual, sin optimizar
          <img src={urlOriginal} alt={`Vista del original: ${doc.nombre_original}`} className="max-h-[85vh] rounded-lg border-2 border-crema-2" />
        )}
      </div>
    </main>
  );
}
