import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ACCESO_DEMO, CUENTAS_DEMO } from "@/config";
import { sesionActual } from "@/servidor/auth/sesion";
import { entrarDemo } from "../acciones-acceso";
import { FormEntrar } from "./FormEntrar";

export const metadata: Metadata = { title: "Entrar · Cuentapp" };

export default async function Entrar() {
  if (await sesionActual()) redirect("/panel");
  return (
    <main className="mx-auto w-full max-w-md px-6 py-12">
      <h1 className="mb-8 text-4xl font-black uppercase tracking-tight">Entrar</h1>
      {ACCESO_DEMO && (
        <section aria-labelledby="demo" className="mb-8 rounded-2xl border-2 border-dashed border-marron p-5">
          <h2 id="demo" className="font-bold">
            Acceso de demostración
          </h2>
          <p className="mt-1 text-sm">Solo en local. Entra sin contraseña con una empresa de prueba.</p>
          <div className="mt-4 flex flex-col gap-3">
            {CUENTAS_DEMO.map((c) => (
              <form key={c.email} action={entrarDemo}>
                <input type="hidden" name="email" value={c.email} />
                <button type="submit" className="w-full rounded-full bg-marron-oscuro px-5 py-2.5 font-bold text-crema hover:bg-marron">
                  Entrar como {c.empresa}
                </button>
              </form>
            ))}
          </div>
        </section>
      )}
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
