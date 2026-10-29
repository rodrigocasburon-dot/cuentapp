// Estado de un documento: SIEMPRE icono + texto, nunca solo color.

import { ETIQUETA_ESTADO, type Estado } from "@/dominio/estados";

const ICONO: Record<Estado, string> = {
  recibido: "↓",
  procesando: "⟳",
  pendiente_revision: "?",
  validado: "✔",
  incidencia: "⚠",
};

// Fondos claros con texto oscuro: contraste AA en todos los casos
const ESTILO: Record<Estado, string> = {
  recibido: "bg-crema-2 text-marron-oscuro border-marron",
  procesando: "bg-crema-2 text-marron-oscuro border-marron",
  pendiente_revision: "bg-white text-marron-oscuro border-arena",
  validado: "bg-white text-marron-oscuro border-marron-oscuro",
  incidencia: "bg-white text-rojo border-rojo",
};

export function EstadoDocumento({ estado }: { estado: Estado }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border-2 px-3 py-0.5 text-sm font-semibold ${ESTILO[estado]}`}>
      <span aria-hidden="true">{ICONO[estado]}</span>
      {ETIQUETA_ESTADO[estado]}
    </span>
  );
}
