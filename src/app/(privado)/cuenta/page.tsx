import type { Metadata } from "next";
import { exigirSesion } from "@/servidor/auth/sesion";
import { FormBaja, FormDatos } from "./FormCuenta";

export const metadata: Metadata = { title: "Mi cuenta · Cuentapp" };

export default async function MiCuenta() {
  const { usuario, empresa } = await exigirSesion();
  return (
    <main className="mx-auto w-full max-w-xl px-6 py-10">
      <h1 className="mb-2 text-4xl font-black uppercase tracking-tight">Mi cuenta</h1>
      <p className="mb-8 text-marron">
        Entras como <span className="font-semibold">{usuario.email}</span>. El email no se puede cambiar.
      </p>

      <section aria-labelledby="datos" className="rounded-2xl border-2 border-crema-2 bg-white p-6">
        <h2 id="datos" className="mb-4 text-xl font-bold">
          Datos
        </h2>
        <FormDatos inicial={{ empresa: empresa.nombre, nif: empresa.nif ?? "", nombre: usuario.nombre }} />
      </section>

      <section aria-labelledby="baja" className="mt-10 rounded-2xl border-2 border-rojo bg-white p-6">
        <h2 id="baja" className="mb-2 text-xl font-bold text-rojo">
          Dar de baja la cuenta
        </h2>
        <p className="mb-4 text-sm">
          Se cierra la sesión y nadie podrá volver a entrar en la empresa <span className="font-semibold">{empresa.nombre}</span>
        </p>
        <FormBaja />
      </section>
    </main>
  );
}
