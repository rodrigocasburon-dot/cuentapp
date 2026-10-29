// Límites y tipos de la subida de documentos (RF-02). Compartido por el
// servidor y por el formulario del navegador (por eso no está en servidor/).

export const TAMANO_MAXIMO = 10 * 1024 * 1024; // 10 MB por archivo
export const MAX_ARCHIVOS_POR_SUBIDA = 10;
export const EXTENSIONES_ADMITIDAS = ".pdf,.jpg,.jpeg,.png,.webp";
export const TEXTO_FORMATOS = "PDF, JPG, PNG o WebP";

export type ResultadoArchivo =
  | { nombre: string; ok: true; id: string; duplicadoDe?: string }
  | { nombre: string; ok: false; motivo: string };

export interface EstadoSubida {
  mensaje?: string;
  resultados?: ResultadoArchivo[];
}
