import type { Metadata } from "next";
import Link from "next/link";
import { after } from "next/server";
import { EstadoDocumento } from "@/componentes/EstadoDocumento";
import { Refresco } from "@/componentes/Refresco";
import { fecha, fechaHora, importe } from "@/dominio/formato";
import { repositorioActual } from "@/servidor/auth/sesion";
import { lanzarCola } from "@/servidor/lectura/cola";
import { FormSubida } from "./FormSubida";

export const metadata: Metadata = { title: "Documentos · Cuentapp" };

export default async function Documentos() {
  const { repo } = await repositorioActual();
  const documentos = repo.listarDocumentos();
  const leyendo = documentos.some((d) => d.estado === "recibido" || d.estado === "procesando");
  // Si quedan pendientes (p. ej. tras reiniciar el servidor), retomar la cola
  if (documentos.some((d) => d.estado === "recibido")) after(lanzarCola);

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <Refresco activo={leyendo} />
      <h1 className="mb-6 text-4xl font-black uppercase tracking-tight">Documentos</h1>
      <FormSubida />

      <section className="mt-10" aria-labelledby="lista">
        <h2 id="lista" className="mb-3 text-xl font-bold">
          Recibidos ({documentos.length})
        </h2>
        {leyendo && (
          <p className="mb-3 text-marron" role="status">
            <span aria-hidden="true">⟳ </span>Leyendo documentos… la lista se actualiza sola.
          </p>
        )}
        {documentos.length === 0 ? (
          <p className="text-marron">Todavía no hay documentos. Sube el primero con el formulario de arriba.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b-2 border-marron-oscuro">
                  <th scope="col" className="py-2 pr-4">Documento</th>
                  <th scope="col" className="py-2 pr-4">Emisor</th>
                  <th scope="col" className="py-2 pr-4">Fecha</th>
                  <th scope="col" className="py-2 pr-4 text-right">Total</th>
                  <th scope="col" className="py-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {documentos.map((d) => (
                  <tr key={d.id} className="border-b border-crema-2 align-top">
                    <td className="py-2 pr-4">
                      <Link href={`/documentos/${d.id}`} className="font-semibold underline underline-offset-4">
                        {d.nombre_original}
                      </Link>
                      <span className="block text-sm text-marron">Recibido {fechaHora(d.creado_en)}</span>
                    </td>
                    <td className="py-2 pr-4">{d.nombre_emisor ?? "—"}</td>
                    <td className="py-2 pr-4 whitespace-nowrap">{d.fecha_emision ? fecha(d.fecha_emision) : "—"}</td>
                    <td className="py-2 pr-4 text-right whitespace-nowrap">
                      {d.total_centimos !== null ? importe(d.total_centimos, d.moneda ?? "EUR") : "—"}
                    </td>
                    <td className="py-2">
                      <EstadoDocumento estado={d.estado} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
