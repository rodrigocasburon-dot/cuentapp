// Página provisional de la fase 1: comprueba que la app arranca y que la
// base de datos responde. La landing de verdad llega en la fase 9.

import { bd } from "@/servidor/bd/conexion";
import { estadoSistema, type EstadoSistema } from "@/servidor/bd/sistema";

export const dynamic = "force-dynamic"; // leer la base de datos en cada visita

function leerEstado(): EstadoSistema | null {
  try {
    return estadoSistema(bd());
  } catch {
    return null; // base de datos sin crear: se explica en pantalla
  }
}

export default function Inicio() {
  const estado = leerEstado();
  const euros = (c: number) => (c / 100).toLocaleString("es-ES", { style: "currency", currency: "EUR" });

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-16">
      <h1 className="text-5xl font-black uppercase tracking-tight">Cuentapp</h1>
      <p className="mt-2 text-lg text-marron">El semáforo del trimestre.</p>

      <section className="mt-10 rounded-2xl bg-crema-2 p-6" aria-labelledby="estado">
        <h2 id="estado" className="text-xl font-bold">Estado del entorno (fase 1)</h2>
        {estado ? (
          <>
            <p className="mt-3">
              <span aria-hidden="true">✔ </span>Base de datos conectada · {estado.empresas} empresas de prueba
            </p>
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
          </>
        ) : (
          <p className="mt-3">
            <span aria-hidden="true">✖ </span>No hay base de datos. Ejecuta <code>npm run db:reset</code> y recarga.
          </p>
        )}
      </section>
    </main>
  );
}
