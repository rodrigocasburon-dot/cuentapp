import type { Metadata } from "next";
import Link from "next/link";
import { EstadoDocumento } from "@/componentes/EstadoDocumento";
import { ETIQUETA_TIPO, type TipoDocumento } from "@/dominio/estados";
import { fecha, importe, mesDe, trimestreActual } from "@/dominio/formato";
import {
  ICONO_SEMAFORO,
  TEXTO_SEMAFORO,
  type ColorSemaforo,
} from "@/dominio/semaforo";
import { repositorioActual } from "@/servidor/auth/sesion";

export const metadata: Metadata = { title: "Panel · Cuentapp" };

const NOMBRE_PLAN: Record<string, string> = { prueba: "Prueba", cuentapp: "Cuentapp", despacho: "Despacho" };

function diasHasta(fechaIso: string): number {
  return Math.max(0, Math.ceil((new Date(fechaIso).getTime() - Date.now()) / 86_400_000));
}

const CLASE_FONDO_SEMAFORO: Record<ColorSemaforo, string> = {
  verde: "border-verde bg-crema-2 text-verde",
  ambar: "border-arena bg-crema-2 text-marron-oscuro",
  rojo: "border-rojo bg-crema-2 text-rojo",
  vacio: "border-marron bg-crema-2 text-marron-oscuro",
};

export default async function Panel({
  searchParams,
}: {
  searchParams?: Promise<{ anio?: string; trimestre?: string }>;
}) {
  const { sesion, repo } = await repositorioActual();
  const { empresa } = sesion;
  const documentos = repo.listarDocumentos();
  const usoMes = repo.usoDelMes(mesDe(new Date()));

  // Trimestres y selección del trimestre para el semáforo (Fase 7)
  const trimestres = repo.listarTrimestres();
  const params = await searchParams;

  // Trimestre elegido en la dirección (validado) o, si no, el más reciente
  const actual = trimestreActual();
  const anioPedido = Number(params?.anio);
  const trimPedido = Number(params?.trimestre);
  const valido = Number.isInteger(anioPedido) && anioPedido >= 2000 && anioPedido <= 2100 && [1, 2, 3, 4].includes(trimPedido);
  const anioSel = valido ? anioPedido : (trimestres[0]?.anio ?? actual.anio);
  const trimSel = valido ? trimPedido : (trimestres[0]?.trimestre ?? actual.trimestre);

  const semaforo = repo.resumenTrimestre(anioSel, trimSel);
  const docsTrimestre = repo.documentosDelTrimestre(anioSel, trimSel);

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black uppercase tracking-tight">{empresa.nombre}</h1>
          <p className="mt-1 text-sm text-marron">
            NIF: {repo.nifEmpresa() ?? "No consta"} · Buzón: <span className="font-mono">{empresa.buzon}</span>
          </p>
        </div>
        <div>
          <Link
            href="/documentos"
            className="rounded-full bg-marron-oscuro px-5 py-2.5 font-bold text-crema hover:bg-marron"
          >
            Subir documentos
          </Link>
        </div>
      </div>

      {/* Resumen del plan y uso */}
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
          <dt className="text-sm text-marron">Documentos totales</dt>
          <dd className="mt-1 text-xl font-bold">
            {documentos.length}
            <span className="block text-base font-normal">{usoMes} recibidos este mes</span>
          </dd>
        </div>
        <div className="rounded-2xl bg-crema-2 p-5">
          <dt className="text-sm text-marron">Trimestre en pantalla</dt>
          <dd className="mt-1 text-xl font-bold">
            {trimSel}T {anioSel}
            <span className="block text-base font-normal">{docsTrimestre.length} documentos</span>
          </dd>
        </div>
      </dl>

      {/* Selector de trimestres */}
      <nav aria-label="Selector de trimestres" className="mt-10">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-marron">Trimestres:</span>
          {trimestres.map((t) => {
            const activo = t.anio === anioSel && t.trimestre === trimSel;
            return (
              <Link
                key={`${t.anio}-${t.trimestre}`}
                href={`/panel?anio=${t.anio}&trimestre=${t.trimestre}`}
                className={`rounded-full px-4 py-1.5 text-sm font-bold transition-colors ${
                  activo
                    ? "bg-marron-oscuro text-crema"
                    : "border border-marron-oscuro text-marron-oscuro hover:bg-crema-2"
                }`}
                aria-current={activo ? "page" : undefined}
              >
                {t.trimestre}T {t.anio} ({t.totalDocumentos})
              </Link>
            );
          })}
        </div>
      </nav>

      {/* SEMÁFORO DEL TRIMESTRE (Propuesta de valor) */}
      <section
        aria-labelledby="titulo-semaforo"
        className={`mt-6 rounded-3xl border-4 p-6 sm:p-8 ${CLASE_FONDO_SEMAFORO[semaforo.color]}`}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="text-xs font-black uppercase tracking-wider text-marron">
              Propuesta de valor · Estado contable
            </span>
            <h2 id="titulo-semaforo" className="mt-1 text-2xl font-black sm:text-3xl">
              El semáforo del trimestre: {trimSel}T {anioSel}
            </h2>
          </div>
          <div className="flex items-center gap-2 rounded-full border-2 border-current bg-white px-4 py-2 font-black shadow-sm">
            <span aria-hidden="true" className="text-2xl">
              {ICONO_SEMAFORO[semaforo.color]}
            </span>
            <span className="text-base text-marron-oscuro">{TEXTO_SEMAFORO[semaforo.color]}</span>
          </div>
        </div>

        <p role="status" className="mt-4 text-base font-semibold text-marron-oscuro">
          {semaforo.motivo}
        </p>

        {/* Métricas clave del trimestre */}
        <div className="mt-6 grid gap-4 border-t-2 border-current/20 pt-6 sm:grid-cols-4">
          <div>
            <span className="text-xs font-bold uppercase text-marron">Total del trimestre</span>
            <p className="mt-1 text-2xl font-black text-marron-oscuro">{importe(semaforo.totalCentimos)}</p>
          </div>
          <div>
            <span className="text-xs font-bold uppercase text-marron">Base imponible</span>
            <p className="mt-1 text-xl font-bold text-marron-oscuro">{importe(semaforo.baseCentimos)}</p>
          </div>
          <div>
            <span className="text-xs font-bold uppercase text-marron">Cuota IVA</span>
            <p className="mt-1 text-xl font-bold text-marron-oscuro">{importe(semaforo.cuotaCentimos)}</p>
          </div>
          <div>
            <span className="text-xs font-bold uppercase text-marron">Estado documentos</span>
            <p className="mt-1 text-sm font-semibold text-marron-oscuro">
              ✔ {semaforo.validados} validados
              <br />
              {semaforo.pendientes > 0 && <span className="text-marron">⚠ {semaforo.pendientes} pendientes </span>}
              {semaforo.incidencias > 0 && <span className="text-rojo">✖ {semaforo.incidencias} incidencias</span>}
            </p>
          </div>
        </div>

        {/* Botón de exportación a Excel (RF-09) */}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t-2 border-current/20 pt-6">
          <p className="text-sm text-marron-oscuro">
            Descarga el desglose contable en Excel listo para enviar a tu gestoría.
          </p>
          <a
            href={`/documentos/exportar?anio=${anioSel}&trimestre=${trimSel}`}
            download
            className="rounded-full bg-marron-oscuro px-6 py-3 font-bold text-crema hover:bg-marron shadow-md transition-transform active:scale-95"
          >
            <span aria-hidden="true">📊 </span>Descargar Excel {trimSel}T {anioSel}
          </a>
        </div>
      </section>

      {/* Desglose de IVA agrupado del trimestre */}
      {semaforo.desgloseIva.length > 0 && (
        <section aria-labelledby="titulo-desglose-iva" className="mt-8 rounded-2xl border-2 border-crema-2 bg-white p-6">
          <h3 id="titulo-desglose-iva" className="text-lg font-bold">
            Desglose de IVA del trimestre ({trimSel}T {anioSel})
          </h3>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b-2 border-marron-oscuro">
                  <th scope="col" className="py-2">Tipo de IVA</th>
                  <th scope="col" className="py-2 text-right">Base Imponible</th>
                  <th scope="col" className="py-2 text-right">Cuota de IVA</th>
                </tr>
              </thead>
              <tbody>
                {semaforo.desgloseIva.map((d) => (
                  <tr key={d.tipo_iva} className="border-b border-crema-2">
                    <td className="py-2 font-semibold">{d.tipo_iva} %</td>
                    <td className="py-2 text-right font-mono">{importe(d.base_centimos)}</td>
                    <td className="py-2 text-right font-mono">{importe(d.cuota_centimos)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Lista de documentos del trimestre */}
      <section aria-labelledby="titulo-documentos-trimestre" className="mt-8">
        <div className="flex items-center justify-between">
          <h3 id="titulo-documentos-trimestre" className="text-xl font-bold">
            Documentos del trimestre ({docsTrimestre.length})
          </h3>
          <Link href="/documentos" className="text-sm font-bold underline underline-offset-4">
            Ver todos los documentos →
          </Link>
        </div>

        {docsTrimestre.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-marron p-6 text-center text-marron">
            No hay documentos registrados para este trimestre ({trimSel}T {anioSel}).
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-2xl border-2 border-crema-2 bg-white">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b-2 border-marron-oscuro bg-crema-2">
                  <th scope="col" className="py-2 px-3">Fecha</th>
                  <th scope="col" className="py-2 px-3">Tipo</th>
                  <th scope="col" className="py-2 px-3">Emisor</th>
                  <th scope="col" className="py-2 px-3">Número</th>
                  <th scope="col" className="py-2 px-3 text-right">Total</th>
                  <th scope="col" className="py-2 px-3">Estado</th>
                  <th scope="col" className="py-2 px-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody>
                {docsTrimestre.map((doc) => (
                  <tr key={doc.id} className="border-b border-crema-2 hover:bg-crema/40">
                    <td className="py-2 px-3 whitespace-nowrap">{doc.fecha_emision ? fecha(doc.fecha_emision) : "—"}</td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      {doc.tipo ? ETIQUETA_TIPO[doc.tipo as TipoDocumento] : "—"}
                    </td>
                    <td className="py-2 px-3 max-w-[12rem] truncate font-medium">
                      {doc.nombre_emisor ?? doc.nombre_original}
                    </td>
                    <td className="py-2 px-3 font-mono text-xs">{doc.numero ?? "—"}</td>
                    <td className="py-2 px-3 text-right font-mono font-bold whitespace-nowrap">
                      {doc.total_eur_centimos !== null
                        ? importe(doc.total_eur_centimos)
                        : doc.total_centimos !== null
                        ? importe(doc.total_centimos)
                        : "—"}
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      <EstadoDocumento estado={doc.estado} />
                    </td>
                    <td className="py-2 px-3 text-right whitespace-nowrap">
                      <Link
                        href={`/documentos/${doc.id}`}
                        className="font-bold underline underline-offset-2 hover:text-marron"
                      >
                        Ver ficha
                      </Link>
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
