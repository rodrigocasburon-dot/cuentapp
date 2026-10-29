// Límites del plan (fase 9). Se comprueban ANTES de recibir archivos, tanto
// en la subida como en el buzón.
//   Prueba:   30 documentos en total (S-02) y solo durante sus 14 días.
//   Cuentapp: 100 documentos al mes; Cuentapp Pro: 300 (mes en hora de España, D-55).
// Cuentan al darse de alta, también los duplicados (S-03).

import { mesDe } from "@/dominio/formato";
import type { Repositorio } from "@/servidor/bd/repositorio";

export interface Cupo {
  disponibles: number;   // cuántos documentos más se pueden recibir ahora
  motivo?: string;       // qué límite se alcanza al agotarlo (para el usuario); sin límite, undefined
}

export function cupoDisponible(repo: Repositorio, ahora = new Date()): Cupo {
  const plan = repo.plan();
  if (plan.prueba_hasta && new Date(plan.prueba_hasta) <= ahora) {
    return { disponibles: 0, motivo: "La prueba gratuita ha terminado. Activa el plan Cuentapp en «Mi cuenta» para seguir subiendo documentos." };
  }
  let disponibles = Infinity;
  let motivo: string | undefined;
  if (plan.limite_docs_total !== null) {
    disponibles = plan.limite_docs_total - repo.usoTotal();
    motivo = `Has llegado al límite de ${plan.limite_docs_total} documentos del plan ${plan.nombre}. Activa el plan Cuentapp en «Mi cuenta».`;
  }
  if (plan.limite_docs_mes !== null) {
    const delMes = plan.limite_docs_mes - repo.usoDelMes(mesDe(ahora));
    if (delMes < disponibles) {
      disponibles = delMes;
      motivo = `Has llegado al límite de ${plan.limite_docs_mes} documentos al mes del plan ${plan.nombre}. El mes que viene se renueva.`;
    }
  }
  // motivo: lo que frenará la subida cuando se agote el cupo (también si aún queda)
  return { disponibles: Math.max(0, disponibles), motivo };
}
