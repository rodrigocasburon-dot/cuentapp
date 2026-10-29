// Tarjetas de los planes, compartidas por la portada y la página de precios.
// Los datos salen de la tabla «planes» (importes provisionales, sin IVA).

import Link from "next/link";
import { AVISO } from "@/dominio/legal";
import type { EstadoSistema } from "@/servidor/bd/sistema";

export const euros = (c: number) => (c / 100).toLocaleString("es-ES", { style: "currency", currency: "EUR" });

/** Plan destacado: el más contratado previsiblemente (supuesto, D-55). */
const DESTACADO = "cuentapp";

export function TarjetasPlanes({ planes }: { planes: EstadoSistema["planes"] }) {
  return (
    <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {planes.map((p) => (
        <li
          key={p.id}
          className={`flex flex-col rounded-3xl p-6 ${p.id === DESTACADO ? "bg-marron-oscuro text-white shadow-2xl shadow-black/20" : "border border-black/5 bg-white"}`}
        >
          <p className="text-lg font-bold">{p.nombre}</p>
          <p className="mt-2 text-3xl font-extrabold">
            {!p.disponible ? "Pronto" : p.dias_prueba ? "Gratis" : euros(p.precio_centimos)}
            {p.disponible && !p.dias_prueba ? <span className="text-base font-semibold opacity-80"> /mes + IVA</span> : null}
          </p>
          <p className={`mt-3 text-sm ${p.id === DESTACADO ? "opacity-90" : "text-marron"}`}>
            {!p.disponible
              ? "Para despachos y gestorías con varias empresas."
              : p.dias_prueba
                ? `${p.dias_prueba} días · hasta ${p.limite_docs_total} documentos. Sin tarjeta y sin cobro automático al terminar.`
                : `Hasta ${p.limite_docs_mes} documentos al mes. Renovación mensual hasta cancelación. ${AVISO.precioProvisional}`}
          </p>
          {p.disponible ? (
            <Link
              href="/registro"
              className={`mt-6 rounded-full px-5 py-2.5 text-center font-semibold ${p.id === DESTACADO ? "bg-lima text-marron-oscuro hover:bg-white" : "bg-marron-oscuro text-white hover:bg-black"}`}
            >
              {p.dias_prueba ? "Probar gratis" : "Empezar"}
            </Link>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
