import type { Metadata } from "next";
import Link from "next/link";
import { EstadoDocumento } from "@/componentes/EstadoDocumento";
import { fechaHora } from "@/dominio/formato";
import { repositorioActual } from "@/servidor/auth/sesion";
import { FormCorreo } from "./FormCorreo";

export const metadata: Metadata = { title: "Buzón · Cuentapp" };

export default async function Buzon() {
  const { repo, sesion } = await repositorioActual();
  const recibidos = repo.listarDocumentos().filter((d) => d.origen === "buzon");

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <h1 className="mb-2 text-4xl font-black uppercase tracking-tight">Buzón</h1>
      <p className="mb-8 max-w-2xl">
        Reenvía a <span className="font-mono font-semibold">{sesion.empresa.buzon}</span> los correos con facturas y
        tickets: los adjuntos entran solos en tus documentos.
      </p>

      <section aria-labelledby="simular" className="rounded-2xl border-2 border-dashed border-marron bg-white/60 p-6">
        <h2 id="simular" className="mb-1 text-xl font-bold">
          Simular un correo entrante
        </h2>
        <p className="mb-4 text-sm text-marron">
          Versión local: todavía no hay servidor de correo, así que la llegada de un correo se simula aquí (o con{" "}
          <code>npm run buzon:simular</code>).
        </p>
        <FormCorreo para={sesion.empresa.buzon} />
      </section>

      <section aria-labelledby="llegados" className="mt-10">
        <h2 id="llegados" className="mb-3 text-xl font-bold">
          Llegados por correo ({recibidos.length})
        </h2>
        {recibidos.length === 0 ? (
          <p className="text-marron">Todavía no ha llegado ningún documento por correo.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b-2 border-marron-oscuro">
                  <th scope="col" className="py-2 pr-4">Documento</th>
                  <th scope="col" className="py-2 pr-4">De</th>
                  <th scope="col" className="py-2 pr-4">Asunto</th>
                  <th scope="col" className="py-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {recibidos.map((d) => (
                  <tr key={d.id} className="border-b border-crema-2 align-top">
                    <td className="py-2 pr-4">
                      <Link href={`/documentos/${d.id}`} className="font-semibold underline underline-offset-4">
                        {d.nombre_original}
                      </Link>
                      <span className="block text-sm text-marron">{fechaHora(d.creado_en)}</span>
                    </td>
                    <td className="py-2 pr-4 break-all">{d.correo_remitente ?? "—"}</td>
                    <td className="py-2 pr-4">{d.correo_asunto || "—"}</td>
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
