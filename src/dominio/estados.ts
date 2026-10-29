// Vocabulario del dominio: estados, tipos e incidencias de un documento.
// Los valores coinciden con los CHECK de bd/esquema.sql; si cambias uno,
// cambia el otro (las pruebas de tests/esquema.test.ts lo vigilan).

export const ESTADOS = [
  "recibido",
  "procesando",
  "pendiente_revision",
  "validado",
  "incidencia",
] as const;
export type Estado = (typeof ESTADOS)[number];

// Texto que ve el usuario (siempre acompañado de icono, nunca solo color)
export const ETIQUETA_ESTADO: Record<Estado, string> = {
  recibido: "Recibido",
  procesando: "Procesando",
  pendiente_revision: "Pendiente de revisión",
  validado: "Validado",
  incidencia: "Incidencia",
};

export const TIPOS_DOCUMENTO = ["factura_completa", "ticket_simplificado"] as const;
export type TipoDocumento = (typeof TIPOS_DOCUMENTO)[number];

export const ETIQUETA_TIPO: Record<TipoDocumento, string> = {
  factura_completa: "Factura completa",
  ticket_simplificado: "Ticket simplificado",
};

export const TIPOS_INCIDENCIA = [
  "duplicado",
  "ilegible",
  "documental",
  "campo_dudoso",
  "falta_nif",
] as const;
export type TipoIncidencia = (typeof TIPOS_INCIDENCIA)[number];
