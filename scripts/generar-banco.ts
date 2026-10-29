// npm run banco:generar
// Genera el banco de documentos SINTÉTICOS para las pruebas de lectura (PL-01..PL-04).
//
// Cada caso produce:
//   banco-tickets/sinteticos/<id>.png   → la imagen que leerán los motores
//   banco-tickets/sinteticos/<id>.json  → la "verdad" con la que se compara la lectura
//
// Todos los datos son inventados (emisores, NIF, importes). Por eso estas
// imágenes SÍ se pueden usar con cualquier motor, incluida una API externa.
// Los documentos reales van en banco-tickets/reales/, que git ignora y que
// solo se leen con motores locales (regla de privacidad, ver SUPUESTOS.md).
//
// Las imágenes se rasterizan con Microsoft Edge en modo headless (viene con
// Windows), así no hace falta ninguna librería gráfica nativa.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { controlCif, letraDni } from "../src/dominio/nif";

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const SALIDA = path.join(process.cwd(), "banco-tickets", "sinteticos");
const TEMPORAL = fs.mkdtempSync(path.join(os.tmpdir(), "cuentapp-banco-"));

// ---------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------

/** CIF ficticio con dígito de control correcto, a partir de un número. */
function cif(letra: string, n: number): string {
  const siete = String(n).padStart(7, "0");
  return letra + siete + controlCif(siete);
}
/** DNI ficticio con letra correcta. */
function dni(n: number): string {
  return String(n).padStart(8, "0") + letraDni(n);
}
/** 1234 → "12,34" */
function euros(centimos: number): string {
  const signo = centimos < 0 ? "-" : "";
  const abs = Math.abs(centimos);
  return `${signo}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, "0")}`;
}
/** "2026-07-14" → "14/07/2026" */
function fechaEs(iso: string): string {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

interface LineaIva { tipo_iva: number; base_centimos: number; cuota_centimos: number }
function linea(tipo_iva: number, base_centimos: number): LineaIva {
  return { tipo_iva, base_centimos, cuota_centimos: Math.round((base_centimos * tipo_iva) / 100) };
}
function sumaTotal(lineas: LineaIva[]): number {
  return lineas.reduce((s, l) => s + l.base_centimos + l.cuota_centimos, 0);
}

// ---------------------------------------------------------------------
// Definición de los casos
// ---------------------------------------------------------------------

type Formato = "ticket" | "factura";
type Degradacion = "ninguna" | "foto" | "ilegible";

interface Caso {
  id: string;
  descripcion: string;          // para qué sirve este caso
  formato: Formato;
  degradacion: Degradacion;
  // --- verdad (lo que debería extraer un lector perfecto) ---
  tipo: "factura_completa" | "ticket_simplificado";
  nombre_emisor: string;
  nif_emisor: string | null;
  direccion_emisor: string;
  nif_receptor: string | null;
  nombre_receptor: string | null;
  numero: string;
  fecha_emision: string;
  moneda: string;
  conceptos: { texto: string; importe_centimos: number }[];  // importes con IVA (ticket) o base (factura)
  lineas_iva: LineaIva[];
  total_centimos: number;       // el total IMPRESO (puede no cuadrar a propósito)
  // --- qué esperamos que haga Cuentapp con él ---
  esperado: {
    validaciones: string[];     // fallos que deben detectar las validaciones deterministas
    semaforo: "verde" | "ambar" | "rojo";
    avisos: string[];
  };
  copia_de?: string;            // duplicado exacto (mismo fichero) de otro caso
}

const RECEPTOR_NIF = "B00000000";  // = empresa-a de npm run db:reset
const RECEPTOR = "Panadería Ejemplo S.L.";

function casos(): Caso[] {
  const l01 = [linea(10, 336)];
  const l02 = [linea(21, 4132)];
  const l03 = [linea(4, 289), linea(10, 1245), linea(21, 820)];
  const l04 = [linea(21, 125000)];
  const l05 = [linea(21, 8900)];
  const l06 = [linea(0, 4999)];
  const l07 = [linea(10, 1820)];
  const l08 = [linea(21, 2479)];
  const l10 = [linea(21, 1500)];
  const l11 = [linea(21, 30000)];
  const l12 = [linea(10, 950)];

  return [
    {
      id: "t01-cafeteria", descripcion: "Ticket simplificado sencillo, 10 % IVA, sin NIF de receptor (aviso informativo)",
      formato: "ticket", degradacion: "ninguna", tipo: "ticket_simplificado",
      nombre_emisor: "Cafetería La Taza Inventada", nif_emisor: cif("B", 4417381), direccion_emisor: "C/ Imaginaria 12, 28000 Madrid",
      nif_receptor: null, nombre_receptor: null, numero: "T-000231", fecha_emision: "2026-07-14", moneda: "EUR",
      conceptos: [{ texto: "2 Café con leche", importe_centimos: 260 }, { texto: "1 Tostada", importe_centimos: 110 }],
      lineas_iva: l01, total_centimos: sumaTotal(l01),
      esperado: { validaciones: [], semaforo: "verde", avisos: ["ticket_sin_nif_receptor"] },
    },
    {
      id: "t02-gasolinera", descripcion: "Ticket de combustible, 21 % IVA",
      formato: "ticket", degradacion: "ninguna", tipo: "ticket_simplificado",
      nombre_emisor: "Estación de Servicio Ficticia", nif_emisor: cif("A", 2850913), direccion_emisor: "Ctra. Supuesta km 4, 41000 Sevilla",
      nif_receptor: null, nombre_receptor: null, numero: "0042-118734", fecha_emision: "2026-08-02", moneda: "EUR",
      conceptos: [{ texto: "Gasóleo A 31,25 L x 1,600", importe_centimos: 5000 }],
      lineas_iva: l02, total_centimos: sumaTotal(l02),
      esperado: { validaciones: [], semaforo: "verde", avisos: ["ticket_sin_nif_receptor"] },
    },
    {
      id: "t03-supermercado", descripcion: "Ticket con tres tipos de IVA (4, 10 y 21 %)",
      formato: "ticket", degradacion: "ninguna", tipo: "ticket_simplificado",
      nombre_emisor: "Supermercados Imaginarios S.A.", nif_emisor: cif("A", 7731402), direccion_emisor: "Av. de Prueba 3, 46000 Valencia",
      nif_receptor: null, nombre_receptor: null, numero: "2026/11/004512", fecha_emision: "2026-09-21", moneda: "EUR",
      conceptos: [
        { texto: "Pan de molde", importe_centimos: 150 }, { texto: "Leche entera 6 u.", importe_centimos: 151 },
        { texto: "Aceite de oliva 1 L", importe_centimos: 870 }, { texto: "Fruta variada", importe_centimos: 500 },
        { texto: "Detergente", importe_centimos: 992 },
      ],
      lineas_iva: l03, total_centimos: sumaTotal(l03),
      esperado: { validaciones: [], semaforo: "verde", avisos: ["ticket_sin_nif_receptor"] },
    },
    {
      id: "f04-asesoria", descripcion: "Factura completa correcta con NIF de emisor y receptor",
      formato: "factura", degradacion: "ninguna", tipo: "factura_completa",
      nombre_emisor: "Asesores de Mentira S.L.", nif_emisor: cif("B", 6120075), direccion_emisor: "Pza. Ficción 1, 08000 Barcelona",
      nif_receptor: RECEPTOR_NIF, nombre_receptor: RECEPTOR, numero: "F2026-0187", fecha_emision: "2026-07-31", moneda: "EUR",
      conceptos: [{ texto: "Servicios de asesoría fiscal, julio 2026", importe_centimos: 125000 }],
      lineas_iva: l04, total_centimos: sumaTotal(l04),
      esperado: { validaciones: [], semaforo: "verde", avisos: [] },
    },
    {
      id: "f05-sin-nif-receptor", descripcion: "Factura completa SIN NIF de receptor (debe dar ámbar)",
      formato: "factura", degradacion: "ninguna", tipo: "factura_completa",
      nombre_emisor: "Suministros Inexistentes S.L.", nif_emisor: cif("B", 3309184), direccion_emisor: "Pol. Ind. Hipotético 7, 50000 Zaragoza",
      nif_receptor: null, nombre_receptor: RECEPTOR, numero: "A-5521", fecha_emision: "2026-08-19", moneda: "EUR",
      conceptos: [{ texto: "Harina de trigo, 4 sacos", importe_centimos: 8900 }],
      lineas_iva: l05, total_centimos: sumaTotal(l05),
      esperado: { validaciones: [], semaforo: "ambar", avisos: ["factura_sin_nif_receptor"] },
    },
    {
      id: "f06-dolares", descripcion: "Factura en USD (requiere tipo de cambio por fecha)",
      formato: "factura", degradacion: "ninguna", tipo: "factura_completa",
      nombre_emisor: "Imaginary Software Inc.", nif_emisor: null, direccion_emisor: "100 Example St, Springfield, USA",
      nif_receptor: RECEPTOR_NIF, nombre_receptor: RECEPTOR, numero: "INV-90412", fecha_emision: "2026-09-03", moneda: "USD",
      conceptos: [{ texto: "Software subscription (annual)", importe_centimos: 4999 }],
      lineas_iva: l06, total_centimos: sumaTotal(l06),
      esperado: { validaciones: [], semaforo: "ambar", avisos: ["factura_sin_nif_emisor", "moneda_extranjera"] },
    },
    {
      id: "t07-foto-torcida", descripcion: "Ticket fotografiado: girado, con ruido y poco contraste",
      formato: "ticket", degradacion: "foto", tipo: "ticket_simplificado",
      nombre_emisor: "Restaurante El Plato Ficticio", nif_emisor: cif("B", 9045126), direccion_emisor: "C/ Inventada 45, 29000 Málaga",
      nif_receptor: null, nombre_receptor: null, numero: "M12-00877", fecha_emision: "2026-07-25", moneda: "EUR",
      conceptos: [{ texto: "Menú del día x2", importe_centimos: 2002 }],
      lineas_iva: l07, total_centimos: sumaTotal(l07),
      esperado: { validaciones: [], semaforo: "verde", avisos: ["ticket_sin_nif_receptor"] },
    },
    {
      id: "t08-ilegible", descripcion: "Ticket muy desenfocado: debe acabar como incidencia 'ilegible' (rojo)",
      formato: "ticket", degradacion: "ilegible", tipo: "ticket_simplificado",
      nombre_emisor: "Ferretería Supuesta", nif_emisor: cif("B", 1187730), direccion_emisor: "C/ Tornillo 9, 15000 A Coruña",
      nif_receptor: null, nombre_receptor: null, numero: "000915", fecha_emision: "2026-08-11", moneda: "EUR",
      conceptos: [{ texto: "Material diverso", importe_centimos: 3000 }],
      lineas_iva: l08, total_centimos: sumaTotal(l08),
      esperado: { validaciones: ["ilegible"], semaforo: "rojo", avisos: [] },
    },
    {
      id: "t09-duplicado-t02", descripcion: "Copia exacta (mismo fichero) de t02: debe detectarse como duplicado",
      formato: "ticket", degradacion: "ninguna", tipo: "ticket_simplificado",
      nombre_emisor: "Estación de Servicio Ficticia", nif_emisor: cif("A", 2850913), direccion_emisor: "Ctra. Supuesta km 4, 41000 Sevilla",
      nif_receptor: null, nombre_receptor: null, numero: "0042-118734", fecha_emision: "2026-08-02", moneda: "EUR",
      conceptos: [{ texto: "Gasóleo A 31,25 L x 1,600", importe_centimos: 5000 }],
      lineas_iva: l02, total_centimos: sumaTotal(l02),
      esperado: { validaciones: ["duplicado"], semaforo: "rojo", avisos: [] },
      copia_de: "t02-gasolinera",
    },
    {
      id: "t10-descuadre", descripcion: "Ticket cuyo total impreso NO cuadra con base + cuota",
      formato: "ticket", degradacion: "ninguna", tipo: "ticket_simplificado",
      nombre_emisor: "Kiosco Hipotético", nif_emisor: cif("B", 5562018), direccion_emisor: "C/ Periódico 2, 37000 Salamanca",
      nif_receptor: null, nombre_receptor: null, numero: "K-3390", fecha_emision: "2026-09-08", moneda: "EUR",
      conceptos: [{ texto: "Prensa y revistas", importe_centimos: 1815 }],
      lineas_iva: l10, total_centimos: sumaTotal(l10) + 100,  // 1 € de más, a propósito
      esperado: { validaciones: ["descuadre_total"], semaforo: "ambar", avisos: [] },
    },
    {
      id: "f11-nif-erroneo", descripcion: "Factura con NIF de emisor con dígito de control incorrecto",
      formato: "factura", degradacion: "ninguna", tipo: "factura_completa",
      nombre_emisor: "Reformas Irreales S.L.", nif_emisor: (() => { const c = cif("B", 4021957); return c.slice(0, 8) + ((Number(c[8]) + 3) % 10); })(),
      direccion_emisor: "C/ Andamio 33, 33000 Oviedo",
      nif_receptor: RECEPTOR_NIF, nombre_receptor: RECEPTOR, numero: "R-2026-044", fecha_emision: "2026-09-15", moneda: "EUR",
      conceptos: [{ texto: "Reparación de horno, mano de obra", importe_centimos: 30000 }],
      lineas_iva: l11, total_centimos: sumaTotal(l11),
      esperado: { validaciones: ["nif_emisor_invalido"], semaforo: "ambar", avisos: [] },
    },
    {
      id: "t12-fecha-futura", descripcion: "Ticket con fecha no plausible (en el futuro)",
      formato: "ticket", degradacion: "ninguna", tipo: "ticket_simplificado",
      nombre_emisor: "Librería Imaginada", nif_emisor: dni(48213077), direccion_emisor: "C/ Página 8, 47000 Valladolid",
      nif_receptor: null, nombre_receptor: null, numero: "L-771", fecha_emision: "2031-02-28", moneda: "EUR",
      conceptos: [{ texto: "Cuaderno A4", importe_centimos: 1045 }],
      lineas_iva: l12, total_centimos: sumaTotal(l12),
      esperado: { validaciones: ["fecha_no_plausible"], semaforo: "ambar", avisos: ["ticket_sin_nif_receptor"] },
    },
  ];
}

// ---------------------------------------------------------------------
// Plantillas HTML
// ---------------------------------------------------------------------

function simbolo(moneda: string): string {
  return moneda === "EUR" ? "€" : moneda === "USD" ? "USD" : moneda;
}

function htmlTicket(c: Caso): string {
  const s = simbolo(c.moneda);
  const filasIva = c.lineas_iva
    .map((l) => `<tr><td>IVA ${l.tipo_iva}%</td><td>${euros(l.base_centimos)}</td><td>${euros(l.cuota_centimos)}</td></tr>`)
    .join("");
  return `
    <div class="papel ticket">
      <div class="c b">${c.nombre_emisor}</div>
      <div class="c">${c.direccion_emisor}</div>
      ${c.nif_emisor ? `<div class="c">NIF: ${c.nif_emisor}</div>` : ""}
      <div class="sep"></div>
      <div>FACTURA SIMPLIFICADA</div>
      <div>Nº: ${c.numero}</div>
      <div>Fecha: ${fechaEs(c.fecha_emision)} 13:42</div>
      <div class="sep"></div>
      ${c.conceptos.map((x) => `<div class="fila"><span>${x.texto}</span><span>${euros(x.importe_centimos)}</span></div>`).join("")}
      <div class="sep"></div>
      <div class="fila b grande"><span>TOTAL ${s}</span><span>${euros(c.total_centimos)}</span></div>
      <div class="sep"></div>
      <table><tr><th></th><th>BASE</th><th>CUOTA</th></tr>${filasIva}</table>
      <div class="sep"></div>
      <div class="c">Pago con tarjeta</div>
      <div class="c">Gracias por su visita</div>
      <div class="c peq">Documento ficticio generado para pruebas</div>
    </div>`;
}

function htmlFactura(c: Caso): string {
  const s = simbolo(c.moneda);
  const base = c.lineas_iva.reduce((t, l) => t + l.base_centimos, 0);
  return `
    <div class="papel factura">
      <div class="cab">
        <div><div class="b grande">${c.nombre_emisor}</div><div>${c.direccion_emisor}</div>${c.nif_emisor ? `<div>NIF: ${c.nif_emisor}</div>` : ""}</div>
        <div class="d"><div class="b grande">FACTURA</div><div>Nº ${c.numero}</div><div>Fecha: ${fechaEs(c.fecha_emision)}</div></div>
      </div>
      <div class="cliente"><div class="b">Cliente</div><div>${c.nombre_receptor ?? ""}</div>${c.nif_receptor ? `<div>NIF: ${c.nif_receptor}</div>` : ""}</div>
      <table class="lineas">
        <tr><th>Concepto</th><th class="d">Importe (${s})</th></tr>
        ${c.conceptos.map((x) => `<tr><td>${x.texto}</td><td class="d">${euros(x.importe_centimos)}</td></tr>`).join("")}
      </table>
      <table class="totales">
        <tr><td>Base imponible</td><td class="d">${euros(base)} ${s}</td></tr>
        ${c.lineas_iva.map((l) => `<tr><td>IVA ${l.tipo_iva}% sobre ${euros(l.base_centimos)}</td><td class="d">${euros(l.cuota_centimos)} ${s}</td></tr>`).join("")}
        <tr class="b"><td>TOTAL</td><td class="d">${euros(c.total_centimos)} ${s}</td></tr>
      </table>
      <div class="pie">Forma de pago: transferencia a 30 días. Documento ficticio generado para pruebas.</div>
    </div>`;
}

const CSS = `
  html,body{margin:0;background:#cfcac2}
  .papel{background:#fbfaf6;color:#1b1b1b;box-sizing:border-box}
  .ticket{width:360px;margin:20px;padding:18px 16px;font:15px/1.35 Consolas,monospace}
  .factura{width:760px;margin:20px;padding:40px;font:15px/1.45 Arial,sans-serif}
  .c{text-align:center}.b{font-weight:bold}.grande{font-size:1.25em}.peq{font-size:11px;margin-top:6px}.d{text-align:right}
  .sep{border-top:1px dashed #555;margin:8px 0}
  .fila{display:flex;justify-content:space-between;gap:8px}
  table{width:100%;border-collapse:collapse}td,th{padding:2px 4px;text-align:right}td:first-child,th:first-child{text-align:left}
  .cab{display:flex;justify-content:space-between;margin-bottom:30px}
  .cliente{border:1px solid #999;padding:10px;width:45%;margin-bottom:24px}
  .lineas th{border-bottom:2px solid #333}.lineas td{border-bottom:1px solid #ccc;padding:6px 4px}
  .totales{width:55%;margin:24px 0 0 auto}.totales tr:last-child td{border-top:2px solid #333;padding-top:6px}
  .pie{margin-top:60px;font-size:12px;color:#444}
  /* Degradaciones */
  .foto{transform:rotate(-4deg) translate(10px,14px);filter:contrast(.7) brightness(.93) sepia(.25)}
  .ilegible{filter:blur(4.5px) contrast(.55)}
`;

// Ruido de grano para simular una foto (filtro SVG, sin imágenes externas)
const RUIDO = `<svg width="0" height="0" style="position:absolute"><filter id="grano"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .35 0"/></filter></svg>
<div style="position:fixed;inset:0;filter:url(#grano);pointer-events:none"></div>`;

function paginaHtml(c: Caso): string {
  const cuerpo = c.formato === "ticket" ? htmlTicket(c) : htmlFactura(c);
  const clase = c.degradacion === "ninguna" ? "" : c.degradacion;
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>${CSS}</style></head>
<body><div class="${clase}">${cuerpo}</div>${c.degradacion === "foto" ? RUIDO : ""}</body></html>`;
}

// ---------------------------------------------------------------------
// Rasterizado con Edge
// ---------------------------------------------------------------------

function capturar(html: string, png: string, ancho: number, alto: number): void {
  const fichero = path.join(TEMPORAL, path.basename(png, ".png") + ".html");
  fs.writeFileSync(fichero, html, "utf8");
  execFileSync(EDGE, [
    "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run",
    `--user-data-dir=${path.join(TEMPORAL, "perfil")}`,  // perfil aislado: no toca el Edge del usuario
    `--window-size=${ancho},${alto}`, `--screenshot=${png}`,
    "file:///" + fichero.replace(/\\/g, "/"),
  ], { stdio: "ignore", timeout: 60_000 });
  if (!fs.existsSync(png)) throw new Error(`Edge no generó ${png}`);
}

function altoTicket(c: Caso): number {
  return 430 + c.conceptos.length * 21 + c.lineas_iva.length * 21;
}

// ---------------------------------------------------------------------
// Programa principal
// ---------------------------------------------------------------------

if (!fs.existsSync(EDGE)) {
  console.error(`No encuentro Edge en ${EDGE}. Ajusta la constante EDGE.`);
  process.exit(1);
}
fs.mkdirSync(SALIDA, { recursive: true });

const indice: { id: string; descripcion: string; imagen: string; verdad: string }[] = [];
for (const c of casos()) {
  const png = path.join(SALIDA, `${c.id}.png`);
  if (c.copia_de) {
    fs.copyFileSync(path.join(SALIDA, `${c.copia_de}.png`), png);  // mismo fichero byte a byte
  } else if (c.formato === "ticket") {
    capturar(paginaHtml(c), png, 400, altoTicket(c));
  } else {
    capturar(paginaHtml(c), png, 800, 820);
  }
  const { formato, degradacion, conceptos, direccion_emisor, copia_de, ...verdad } = c;
  void formato; void degradacion; void conceptos; void direccion_emisor; void copia_de;
  fs.writeFileSync(path.join(SALIDA, `${c.id}.json`), JSON.stringify(verdad, null, 2) + "\n", "utf8");
  indice.push({ id: c.id, descripcion: c.descripcion, imagen: `${c.id}.png`, verdad: `${c.id}.json` });
  console.log(`✓ ${c.id}`);
}
fs.writeFileSync(path.join(SALIDA, "indice.json"), JSON.stringify(indice, null, 2) + "\n", "utf8");
fs.rmSync(TEMPORAL, { recursive: true, force: true });
console.log(`\n${indice.length} documentos sintéticos en ${SALIDA}`);
