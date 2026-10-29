import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { sesionActual } from "@/servidor/auth/sesion";
import { FormRegistro } from "./FormRegistro";

export const metadata: Metadata = { title: "Crear cuenta · Cuentapp" };

export default async function Registro() {
  if (await sesionActual()) redirect("/panel");
  return (
    <main className="mx-auto w-full max-w-md px-6 py-12">
      <h1 className="text-4xl font-black uppercase tracking-tight">Crear cuenta</h1>
      <p className="mt-2 mb-8 text-marron">14 días de prueba gratis, hasta 30 documentos. Sin tarjeta.</p>
      <FormRegistro />
      <p className="mt-8">
        ¿Ya tienes cuenta?{" "}
        <Link href="/entrar" className="font-semibold underline underline-offset-4">
          Entrar
        </Link>
      </p>
    </main>
  );
}
