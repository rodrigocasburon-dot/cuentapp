// Textos y versiones legales (guía legal de implementación v1.0, 29/10/2026).
// Las páginas legales siguen «pendientes» hasta tener titular, NIF, domicilio y
// canal de privacidad reales (PV-03): no se publican plantillas con {variables}.

/** Versión que se guarda al aceptar. Cambiarla cuando lleguen los textos definitivos. */
export const VERSION_TEXTOS_LEGALES = "pendiente-2026-10-29";

/** Páginas públicas (/legal/<clave>; contenido mínimo en la guía, cap. 07) y su título. */
export const PAGINAS_LEGALES = {
  "aviso-legal": "Aviso legal",
  privacidad: "Política de privacidad",
  condiciones: "Condiciones del servicio",
  encargo: "Acuerdo de tratamiento de datos (encargo)",
  cookies: "Cookies",
} as const;

export type PaginaLegal = keyof typeof PAGINAS_LEGALES;

/** Avisos en contexto (textos de la guía, adaptados donde la app local difiere). */
export const AVISO = {
  subida:
    "Sube únicamente documentos que tu empresa esté autorizada a tratar. Evita datos personales que no sean necesarios. La lectura automática puede cometer errores: revisa los campos antes de pulsar Validar. Conserva el documento original de origen cuando corresponda.",
  archivoRechazado: "No hemos podido aceptar este archivo por su formato, tamaño o seguridad. Prueba con un PDF o una imagen compatible. No lo hemos enviado al servicio de lectura.",
  // Adaptado: en esta versión la lectura es OCR local, sin inteligencia artificial ni servicios externos
  lectura:
    "Cuentapp propone los datos del documento con lectura automática (OCR) hecha en este mismo equipo. Puede omitir o interpretar mal información. Comprueba los campos resaltados y el original: el documento solo quedará validado cuando pulses Validar. La lectura y el semáforo no sustituyen la revisión de tu gestoría.",
  buzon:
    "Procesaremos los adjuntos para incorporarlos a Cuentapp. No conectamos ni leemos tu buzón de Gmail. Comprueba después los documentos recibidos. No compartas esta dirección fuera de tu empresa.",
  buzonSimulado: "Buzón simulado: no recibe correo real.",
  correoSinAdjuntos: "Hemos recibido el mensaje, pero no contiene adjuntos compatibles. Reenvía la factura como PDF o imagen. No se ha creado ningún documento.",
  copiaLocal: "Copia local de demostración; Google Drive no está conectado.",
  semaforo:
    "El indicador se refiere solo a los documentos registrados en Cuentapp. No garantiza que hayas registrado todos tus gastos, ni la validez fiscal, ni la deducibilidad de cada documento.",
  ticketSinNif: "Consulta con tu gestoría si necesitas datos adicionales para deducir este gasto.",
  excel:
    "Este Excel contiene los datos y estados del periodo seleccionado. Revisa el resumen y compártelo solo con personas autorizadas. No es una declaración tributaria ni certifica que los gastos sean deducibles.",
  prueba: "Prueba gratuita de 14 días, hasta 30 documentos. No necesitas tarjeta y no se realizará ningún cobro automático al terminar. Para continuar tendrás que contratar un plan.",
  precioProvisional: "Precio provisional: el tratamiento del IVA y el límite de documentos están pendientes de confirmar.",
} as const;
