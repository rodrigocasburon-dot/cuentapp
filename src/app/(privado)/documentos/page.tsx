import type { Metadata } from "next";
import Link from "next/link";
import { EstadoDocumento } from "@/componentes/EstadoDocumento";
import { fechaHora, tamano } from "@/dominio/formato";
import { repositorioActual } from "@/servidor/auth/sesion";
import { FormSubida } from "./FormSubida";

export const metadata: Metadata = { title: "Documentos · Cuentapp" };

export default async function Documentos() {
  const { repo } = await repositorioActual();
  const documentos = repo.listarDocumentos();

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <h1 className="mb-6 text-4xl font-black uppercase tracking-tight">Documentos</h1>
      <FormSubida />

      <section className="mt-10" aria-labelledby="lista">
        <h2 id="lista" className="mb-3 text-xl font-bold">
          Recibidos ({documentos.length})
        </h2>
        {documentos.length === 0 ? (
          <p className="text-marron">Todavía no hay documentos. Sube el primero con el formulario de arriba.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b-2 border-marron-oscuro">
                  <th scope="col" className="py-2 pr-4">Documento</th>
                  <th scope="col" className="py-2 pr-4">Recibido</th>
                  <th scope="col" className="py-2 pr-4">Tamaño</th>
                  <th scope="col" className="py-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {documentos.map((d) => (
                  <tr key={d.id} className="border-b border-crema-2">
                    <td className="py-2 pr-4">
                      <Link href={`/documentos/${d.id}`} className="font-semibold underline underline-offset-4">
                        {d.nombre_original}
                      </Link>
                    </td>
                    <td className="py-2 pr-4 whitespace-nowrap">{fechaHora(d.creado_en)}</td>
                    <td className="py-2 pr-4 whitespace-nowrap">{tamano(d.tamano_bytes)}</td>
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
