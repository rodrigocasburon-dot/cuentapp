import type { Metadata } from "next";
import { fecha, importe, mesDe } from "@/dominio/formato";
import { AVISO } from "@/dominio/legal";
import { repositorioActual } from "@/servidor/auth/sesion";
import { bd } from "@/servidor/bd/conexion";
import { estadoSistema } from "@/servidor/bd/sistema";
import { cupoDisponible } from "@/servidor/documentos/limites";
import { conIva, stripeActivo } from "@/servidor/pagos/stripe";
import { activarPlanAction } from "./acciones";
import { FormBaja, FormDatos } from "./FormCuenta";

export const metadata: Metadata = { title: "Mi cuenta · Cuentapp" };

export default async function MiCuenta({ searchParams }: { searchParams: Promise<{ plan?: string; pago?: string }> }) {
  const { repo, sesion } = await repositorioActual();
  const { usuario, empresa } = sesion;
  const plan = repo.plan();
  const cupo = cupoDisponible(repo);
  const usoMes = repo.usoDelMes(mesDe(new Date()));
  const { plan: planCambiado, pago } = await searchParams;
  const conStripe = stripeActivo();
  const planesDePago = estadoSistema(bd()).planes.filter((p) => p.disponible && p.id !== "prueba");

  return (
    <main className="mx-auto w-full max-w-xl px-6 py-10">
      <h1 className="mb-2 text-4xl font-black uppercase tracking-tight">Mi cuenta</h1>
      <p className="mb-8 text-marron">
        Entras como <span className="font-semibold">{usuario.email}</span>. El email no se puede cambiar.
      </p>

      <section aria-labelledby="plan" className="rounded-2xl border-2 border-crema-2 bg-white p-6">
        <h2 id="plan" className="mb-2 text-xl font-bold">
          Plan: {plan.nombre}
        </h2>
        {planCambiado && (
          <p role="status" className="mb-3 rounded-lg border-2 border-marron-oscuro bg-crema-2 px-4 py-2 font-semibold">
            <span aria-hidden="true">✔ </span>Plan activado.
          </p>
        )}
        {pago === "cancelado" && (
          <p role="status" className="mb-3 rounded-lg border-2 border-marron-oscuro bg-crema-2 px-4 py-2 font-semibold">
            <span aria-hidden="true">ℹ </span>Pago cancelado: tu plan no ha cambiado.
          </p>
        )}
        {pago === "error" && (
          <p role="alert" className="mb-3 rounded-lg border-2 border-rojo bg-white px-4 py-2 font-semibold text-rojo">
            <span aria-hidden="true">⚠ </span>No se ha podido confirmar el pago y el plan no ha cambiado. Vuelve a intentarlo.
          </p>
        )}
        <ul className="mb-4 space-y-1 text-sm">
          {plan.limite_docs_total !== null && (
            <li>
              {repo.usoTotal()} de {plan.limite_docs_total} documentos usados
              {plan.prueba_hasta ? ` · la prueba acaba el ${fecha(plan.prueba_hasta.slice(0, 10))}` : ""}
            </li>
          )}
          {plan.limite_docs_mes !== null && (
            <li>
              {usoMes} de {plan.limite_docs_mes} documentos este mes · {importe(plan.precio_centimos)} al mes sin IVA
            </li>
          )}
          {cupo.disponibles === 0 && cupo.motivo && (
            <li className="font-semibold text-rojo">
              <span aria-hidden="true">⚠ </span>
              {cupo.motivo}
            </li>
          )}
        </ul>
        {/* Planes de pago a los que se puede cambiar (el servidor vuelve a comprobarlo) */}
        <div className="flex flex-col gap-3">
          {planesDePago
            .filter((p) => p.id !== plan.id)
            .map((p) => (
              <form key={p.id} action={activarPlanAction.bind(null, p.id)}>
                <button type="submit" className="w-full rounded-full bg-marron-oscuro px-6 py-3 font-bold text-white hover:bg-black sm:w-auto">
                  {plan.id === "prueba" ? "Activar" : "Cambiar a"} {p.nombre} · {importe(p.precio_centimos)} al mes + IVA · {p.limite_docs_mes} documentos/mes
                  {conStripe ? ` (${importe(conIva(p.precio_centimos))} con IVA)` : ""}
                </button>
              </form>
            ))}
          <p className="text-sm text-marron">
            {plan.id === "prueba" ? `${AVISO.prueba} ` : ""}
            {AVISO.precioProvisional}{" "}
            {conStripe ? (
              <>
                <strong>Pago de prueba con Stripe:</strong> no se cobra dinero real. Usa la tarjeta 4242 4242 4242 4242, cualquier fecha
                futura y cualquier CVC. Al cambiar de plan se cancela la suscripción anterior.
              </>
            ) : (
              "Versión de demostración: no se cobra nada."
            )}
          </p>
        </div>
      </section>

      <section aria-labelledby="datos" className="mt-10 rounded-2xl border-2 border-crema-2 bg-white p-6">
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
