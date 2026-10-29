import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EstadoDocumento } from "@/componentes/EstadoDocumento";
import { fechaHora, tamano } from "@/dominio/formato";
import { repositorioActual } from "@/servidor/auth/sesion";
import { originalIntegro } from "@/servidor/documentos/servir-original";

export const metadata: Metadata = { title: "Documento · Cuentapp" };

export default async function FichaDocumento({ params }: { params: Promise<{ id: string }> }) {
  const { repo } = await repositorioActual();
  const { id } = await params;
  const doc = repo.obtenerDocumento(id);
  if (!doc) notFound(); // tampoco si es de otra empresa

  const integro = originalIntegro(doc.ruta_original, doc.hash_sha256);
  const urlOriginal = `/documentos/${doc.id}/original`;

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <p className="mb-4">
        <Link href="/documentos" className="underline underline-offset-4">
          ← Documentos
        </Link>
      </p>
      <h1 className="break-words text-3xl font-black tracking-tight">{doc.nombre_original}</h1>
      <div className="mt-3">
        <EstadoDocumento estado={doc.estado} />
      </div>

      <dl className="mt-6 grid gap-x-6 gap-y-3 sm:grid-cols-[max-content_1fr]">
        <dt className="font-semibold">Recibido</dt>
        <dd>{fechaHora(doc.creado_en)} · {doc.origen === "buzon" ? "por el buzón" : "subido a mano"}</dd>
        <dt className="font-semibold">Formato</dt>
        <dd>{doc.mime} · {tamano(doc.tamano_bytes)}</dd>
        <dt className="font-semibold">Huella SHA-256</dt>
        <dd className="break-all font-mono text-sm">{doc.hash_sha256}</dd>
        <dt className="font-semibold">Original</dt>
        <dd className={integro ? "" : "font-semibold text-rojo"}>
          <span aria-hidden="true">{integro ? "✔ " : "⚠ "}</span>
          {integro ? "Intacto: coincide con su huella." : "No coincide con su huella o no se encuentra. Avisa al equipo."}
        </dd>
      </dl>

      <div className="mt-6 flex flex-wrap gap-3">
        <a href={urlOriginal} target="_blank" rel="noopener" className="rounded-full bg-marron-oscuro px-5 py-2 font-bold text-crema hover:bg-marron">
          Abrir el original
        </a>
        <a href={`${urlOriginal}?descargar=1`} className="rounded-full border-2 border-marron-oscuro px-5 py-2 font-bold hover:bg-crema-2">
          Descargar
        </a>
      </div>

      {integro && doc.mime.startsWith("image/") && (
        // eslint-disable-next-line @next/next/no-img-element -- el original se sirve tal cual, sin optimizar
        <img src={urlOriginal} alt={`Vista del original: ${doc.nombre_original}`} className="mt-8 max-h-[80vh] rounded-lg border-2 border-crema-2" />
      )}
    </main>
  );
}
