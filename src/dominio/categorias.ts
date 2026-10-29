// Categoría del gasto (RFQ, requisito 3: «categoría del gasto»).
//
// La lectura no la saca del documento (casi ningún ticket la trae escrita):
// se SUGIERE a partir del nombre del emisor y del texto leído, con palabras
// clave deterministas, y el usuario la corrige en la ficha como cualquier otro
// campo. Lista cerrada y corta a propósito: es lo que el gestor espera ver
// agrupado; ver D-56 en SUPUESTOS.md.

export const CATEGORIAS = [
  "combustible",
  "transporte",
  "restaurantes",
  "alimentacion",
  "alojamiento",
  "suministros",
  "software",
  "material",
  "servicios",
  "otros",
] as const;

export type Categoria = (typeof CATEGORIAS)[number];

export const ETIQUETA_CATEGORIA: Record<Categoria, string> = {
  combustible: "Combustible",
  transporte: "Transporte y aparcamiento",
  restaurantes: "Restaurantes y dietas",
  alimentacion: "Supermercado y alimentación",
  alojamiento: "Alojamiento",
  suministros: "Luz, agua, teléfono e internet",
  software: "Software y suscripciones",
  material: "Material y equipos",
  servicios: "Servicios profesionales",
  otros: "Otros gastos",
};

export function esCategoria(v: unknown): v is Categoria {
  return typeof v === "string" && (CATEGORIAS as readonly string[]).includes(v);
}

/** Etiqueta para mostrar; «Sin categoría» si no hay o no se reconoce. */
export function etiquetaCategoria(v: string | null | undefined): string {
  return esCategoria(v) ? ETIQUETA_CATEGORIA[v] : "Sin categoría";
}

// Palabras clave por categoría, sin tildes (el texto se compara sin tildes).
// Una palabra acabada en «*» vale como prefijo («abogad*» → abogado, abogados);
// el resto tiene que aparecer entera («bar» no casa con «barra»).
// Gana la primera categoría que encaja: el combustible va antes que la
// alimentación porque las gasolineras venden de todo y su ticket nombra el carburante.
const PALABRAS: [Categoria, string[]][] = [
  ["combustible", ["gasolinera*", "gasolina", "gasoleo", "diesel", "carburante*", "sin plomo", "repsol", "cepsa", "galp", "moeve", "petronor", "bp", "shell", "ballenoil", "plenoil", "petroprix", "adblue"]],
  ["transporte", ["renfe", "ouigo", "iryo", "alsa", "taxi*", "cabify", "uber", "bolt", "metro", "autobus*", "aparcamiento*", "parking", "peaje*", "autopista*", "vueling", "iberia", "ryanair", "air europa"]],
  ["alojamiento", ["hotel*", "hostal*", "apartamento*", "airbnb", "booking.com", "parador*", "alojamiento*"]],
  ["restaurantes", ["restaurante*", "bar", "cafeteria*", "cafe", "menu del dia", "taberna*", "asador*", "pizzeria*", "burger*", "tapas"]],
  ["alimentacion", ["mercadona", "carrefour", "lidl", "aldi", "dia retail", "supermercados dia", "eroski", "alcampo", "consum", "hipercor", "supermercado*", "hipermercado*", "fruteria*", "panaderia*", "carniceria*"]],
  ["suministros", ["iberdrola", "endesa", "naturgy", "holaluz", "electricidad", "energia", "canal de isabel", "movistar", "vodafone", "orange", "yoigo", "digi", "masmovil", "fibra", "telefonia", "internet"]],
  ["software", ["software", "suscripcion*", "subscription*", "licencia*", "google", "microsoft", "adobe", "github", "notion", "slack", "zoom", "dropbox", "openai", "anthropic", "amazon web services", "hosting", "saas"]],
  ["material", ["papeleria*", "material de oficina", "ferreteria*", "leroy merlin", "bricomart", "ikea", "mediamarkt", "pccomponentes", "fnac", "ordenador*", "portatil*", "impresora*", "toner*", "herramienta*"]],
  ["servicios", ["asesoria*", "gestoria*", "abogad*", "notaria*", "consultoria*", "honorarios", "servicios profesionales", "auditoria*", "formacion", "curso*"]],
];

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Ni letra ni número antes (y, si no es prefijo, tampoco después)
const LIMITE = String.raw`[\p{L}\p{N}]`;
const REGLAS: [Categoria, RegExp][] = PALABRAS.map(([categoria, palabras]) => {
  const alternativas = palabras.map((p) => (p.endsWith("*") ? escapar(p.slice(0, -1)) : `${escapar(p)}(?!${LIMITE})`));
  return [categoria, new RegExp(`(?<!${LIMITE})(?:${alternativas.join("|")})`, "u")];
});

/** Minúsculas y sin tildes: «Gasóleo» → «gasoleo». */
const normalizar = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/**
 * Sugiere una categoría. Mira primero el emisor (más fiable) y después el
 * texto completo leído. Devuelve null si nada encaja: mejor «sin categoría»
 * que una categoría inventada.
 */
export function sugerirCategoria(nombreEmisor: string | null | undefined, texto?: string | null): Categoria | null {
  for (const fuente of [nombreEmisor, texto]) {
    if (!fuente) continue;
    const t = normalizar(fuente);
    for (const [categoria, regla] of REGLAS) if (regla.test(t)) return categoria;
  }
  return null;
}
