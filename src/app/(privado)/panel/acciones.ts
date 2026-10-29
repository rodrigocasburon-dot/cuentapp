"use server";

// Copia local del trimestre (fase 8). La empresa sale de la sesión.

import { redirect } from "next/navigation";
import { repositorioActual } from "@/servidor/auth/sesion";
import { copiarTrimestre } from "@/servidor/documentos/copia-local";

export async function copiarTrimestreAction(anio: number, trimestre: number): Promise<void> {
  const { repo } = await repositorioActual();
  if (!Number.isInteger(anio) || anio < 2000 || anio > 2100 || ![1, 2, 3, 4].includes(trimestre)) redirect("/panel");
  const r = await copiarTrimestre(repo, anio, trimestre);
  const q = new URLSearchParams({
    anio: String(anio),
    trimestre: String(trimestre),
    copiados: String(r.copiados),
    yaEstaban: String(r.yaEstaban),
    sinValidar: String(r.sinValidar),
    fallidos: String(r.fallidos),
  });
  redirect(`/panel?${q}`);
}
