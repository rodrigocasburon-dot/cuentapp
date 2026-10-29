import type { Metadata } from "next";
import Link from "next/link";
import { bd } from "@/servidor/bd/conexion";
import { recuperacionValida } from "@/servidor/bd/cuentas";
import { FormNuevaContrasena } from "./FormNuevaContrasena";

// El token va en la dirección: que no salga a otras webs en el Referer
export const metadata: Metadata = { title: "Contraseña nueva · Cuentapp", referrer: "no-referrer" };

export default async function NuevaContrasena({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const valido = /^[A-Za-z0-9_-]{43}$/.test(token) && recuperacionValida(bd(), token);
  return (
    <main className="mx-auto w-full max-w-md px-6 py-12">
      <h1 className="mb-8 text-4xl font-black uppercase tracking-tight">Contraseña nueva</h1>
      {valido ? (
        <>
          <p className="mb-8">Al guardarla se cerrarán todas las sesiones abiertas de tu cuenta.</p>
          <FormNuevaContrasena token={token} />
        </>
      ) : (
        <p role="alert" className="rounded-lg border-2 border-rojo bg-white px-4 py-3 font-semibold text-rojo">
          <span aria-hidden="true">⚠ </span>
          Este enlace ya no vale: ha caducado o ya se ha usado.{" "}
          <Link href="/recuperar" className="underline underline-offset-4">
            Pide uno nuevo
          </Link>
          .
        </p>
      )}
    </main>
  );
}
