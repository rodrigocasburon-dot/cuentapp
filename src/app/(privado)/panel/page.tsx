import type { Metadata } from "next";
import Link from "next/link";
import { repositorioActual } from "@/servidor/auth/sesion";
import { mesDe } from "@/dominio/formato";

export const metadata: Metadata = { title: "Panel · Cuentapp" };

const NOMBRE_PLAN: Record<string, string> = { prueba: "Prueba", cuentapp: "Cuentapp", despacho: "Despacho" };

/** Días que faltan hasta una fecha (0 si ya pasó). */
function diasHasta(fechaIso: string): number {
  return Math.max(0, Math.ceil((new Date(fechaIso).getTime() - Date.now()) / 86_400_000));
}

export default async function Panel() {
  const { sesion, repo } = await repositorioActual();
  const { empresa } = sesion;
  const documentos = repo.listarDocumentos();
  const usoMes = repo.usoDelMes(mesDe(new Date()));

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <h1 className="text-4xl font-black uppercase tracking-tight">{empresa.nombre}</h1>

      <dl className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl bg-crema-2 p-5">
          <dt className="text-sm text-marron">Plan</dt>
          <dd className="mt-1 text-xl font-bold">
            {NOMBRE_PLAN[empresa.plan_id] ?? empresa.plan_id}
            {empresa.plan_id === "prueba" && empresa.prueba_hasta && (
              <span className="block text-base font-normal">Quedan {diasHasta(empresa.prueba_hasta)} días</span>
            )}
          </dd>
        </div>
        <div className="rounded-2xl bg-crema-2 p-5">
          <dt className="text-sm text-marron">Documentos</dt>
          <dd className="mt-1 text-xl font-bold">
            {documentos.length}
            <span className="block text-base font-normal">{usoMes} recibidos este mes</span>
          </dd>
        </div>
        <div className="rounded-2xl bg-crema-2 p-5">
          <dt className="text-sm text-marron">Tu buzón</dt>
          <dd className="mt-1 break-all font-mono text-sm">{empresa.buzon}</dd>
        </div>
      </dl>

      {documentos.length === 0 && (
        <section className="mt-10 rounded-2xl border-2 border-dashed border-marron p-8 text-center">
          <h2 className="text-xl font-bold">Aún no has subido documentos</h2>
          <p className="mt-2 text-marron">Aquí verás tus facturas y tickets, y el semáforo del trimestre.</p>
          <Link href="/documentos" className="mt-4 inline-block rounded-full bg-marron-oscuro px-6 py-3 font-bold text-crema hover:bg-marron">
            Subir documentos
          </Link>
        </section>
      )}
    </main>
  );
}
