import type { Metadata } from "next";
import Link from "next/link";
import { MODO } from "@/config";
import { FormRecuperar } from "./FormRecuperar";

export const metadata: Metadata = { title: "Recuperar la contraseña · Cuentapp" };

export default function Recuperar() {
  return (
    <main className="mx-auto w-full max-w-md px-6 py-12">
      <h1 className="mb-4 text-4xl font-black uppercase tracking-tight">Recuperar la contraseña</h1>
      <p className="mb-8">Escribe el email con el que entras y te enviaremos un enlace para crear una contraseña nueva.</p>
      {MODO === "local" && (
        <p className="mb-8 rounded-2xl border-2 border-dashed border-marron p-4 text-sm">
          <strong>MVP local:</strong> no se envían correos de verdad. El mensaje se guarda en la carpeta{" "}
          <code>datos/correos-salientes</code> del equipo donde se ejecuta la app.
        </p>
      )}
      <FormRecuperar />
      <p className="mt-8">
        <Link href="/entrar" className="font-semibold underline underline-offset-4">
          Volver a entrar
        </Link>
      </p>
    </main>
  );
}
