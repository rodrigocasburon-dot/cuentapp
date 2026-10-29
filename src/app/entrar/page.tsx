import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { sesionActual } from "@/servidor/auth/sesion";
import { FormEntrar } from "./FormEntrar";

export const metadata: Metadata = { title: "Entrar · Cuentapp" };

export default async function Entrar() {
  if (await sesionActual()) redirect("/panel");
  return (
    <main className="mx-auto w-full max-w-md px-6 py-12">
      <h1 className="mb-8 text-4xl font-black uppercase tracking-tight">Entrar</h1>
      <FormEntrar />
      <p className="mt-8">
        ¿Aún no tienes cuenta?{" "}
        <Link href="/registro" className="font-semibold underline underline-offset-4">
          Crear cuenta
        </Link>
      </p>
    </main>
  );
}
