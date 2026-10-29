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
      <header className="border-b-2 border-crema-2 bg-crema-2">
        <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-3 px-6 py-3">
          <Link href="/panel" className="text-2xl font-black uppercase tracking-tight">
            Cuentapp
          </Link>
          <div className="flex items-center gap-4">
            <p className="text-sm">
              <span className="font-semibold">{empresa.nombre}</span>
              <span className="text-marron"> · {usuario.nombre}</span>
            </p>
            <form action={salir}>
              <button type="submit" className="rounded-full border-2 border-marron-oscuro px-4 py-1 font-semibold hover:bg-crema focus:outline-none focus-visible:ring-4 focus-visible:ring-marron/40">
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
