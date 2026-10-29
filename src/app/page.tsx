// Portada provisional. La landing de verdad (diseño, líneas topográficas,
// página de precios) llega en la fase 9.

import Link from "next/link";
import { redirect } from "next/navigation";
import { sesionActual } from "@/servidor/auth/sesion";
import { bd } from "@/servidor/bd/conexion";
import { estadoSistema, type EstadoSistema } from "@/servidor/bd/sistema";

export const dynamic = "force-dynamic"; // leer la base de datos en cada visita

function leerEstado(): EstadoSistema | null {
  try {
    return estadoSistema(bd());
  } catch {
    return null; // base de datos sin crear o de otra versión: se explica en pantalla
  }
}

export default async function Inicio() {
  const estado = leerEstado();
  if (estado && (await sesionActual())) redirect("/panel");
  const euros = (c: number) => (c / 100).toLocaleString("es-ES", { style: "currency", currency: "EUR" });

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-16">
      <h1 className="text-5xl font-black uppercase tracking-tight">Cuentapp</h1>
      <p className="mt-2 text-lg text-marron">El semáforo del trimestre: tus facturas y tickets, listos para el gestor.</p>

      {estado ? (
        <>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link href="/registro" className="rounded-full bg-marron-oscuro px-6 py-3 font-bold text-crema hover:bg-marron">
              Crear cuenta
            </Link>
            <Link href="/entrar" className="rounded-full border-2 border-marron-oscuro px-6 py-3 font-bold hover:bg-crema-2">
              Entrar
            </Link>
          </div>
          <section className="mt-12 rounded-2xl bg-crema-2 p-6" aria-labelledby="planes">
            <h2 id="planes" className="text-xl font-bold">Planes</h2>
            <ul className="mt-3 space-y-1">
              {estado.planes.map((p) => (
                <li key={p.id}>
                  <strong>{p.nombre}</strong>:{" "}
                  {!p.disponible
                    ? "próximamente"
                    : p.dias_prueba
                      ? `gratis ${p.dias_prueba} días · ${p.limite_docs_total} documentos`
                      : `${euros(p.precio_centimos)}/mes sin IVA · ${p.limite_docs_mes} documentos/mes`}
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : (
        <p className="mt-10 rounded-2xl bg-crema-2 p-6">
          <span aria-hidden="true">✖ </span>La base de datos no existe o es de una versión anterior. Ejecuta{" "}
          <code>npm run db:reset</code> y recarga.
        </p>
      )}
    </main>
  );
}
