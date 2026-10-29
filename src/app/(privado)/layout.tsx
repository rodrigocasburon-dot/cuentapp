// Zona privada: todo lo que cuelga de (privado) exige sesión.
// Ojo: esto protege las PÁGINAS. Los datos se protegen además en
// repositorioActual(), porque las acciones de servidor no pasan por aquí.

import Link from "next/link";
import { exigirSesion } from "@/servidor/auth/sesion";
import { salir } from "../acciones-acceso";

export default async function LayoutPrivado({ children }: { children: React.ReactNode }) {
  const { usuario, empresa } = await exigirSesion();
  return (
    <>
      <header className="sticky top-0 z-10 border-b border-black/5 bg-white/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-3">
          <nav aria-label="Principal" className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Link href="/panel" className="mr-2 flex items-center gap-2 text-xl font-extrabold tracking-tight">
              <span aria-hidden="true" className="grid h-8 w-8 place-items-center rounded-xl bg-marron-oscuro text-sm">
                🚦
              </span>
              Cuentapp
            </Link>
            {[
              ["/panel", "Panel"],
              ["/documentos", "Documentos"],
              ["/buzon", "Buzón"],
              ["/cuenta", "Mi cuenta"],
            ].map(([href, texto]) => (
              <Link key={href} href={href} className="rounded-full px-3 py-1.5 text-sm font-semibold hover:bg-crema-2">
                {texto}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-4">
            <p className="text-sm">
              <span className="font-semibold">{empresa.nombre}</span>
              <span className="text-marron"> · {usuario.nombre}</span>
            </p>
            <form action={salir}>
              <button type="submit" className="rounded-full bg-marron-oscuro px-4 py-1.5 text-sm font-semibold text-white hover:bg-black focus:outline-none focus-visible:ring-4 focus-visible:ring-lima">
                Salir
              </button>
            </form>
          </div>
        </div>
      </header>
      {children}
    </>
  );
}
