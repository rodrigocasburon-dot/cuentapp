// «Compartir» desde el móvil (RFQ, requisito 2, tercera vía; D-58).
//
// Con Cuentapp instalada como app (PWA), el manifiesto la declara destino de
// «Compartir» (share_target): en el móvil, desde el correo o desde la carpeta
// de descargas, se toca Compartir → Cuentapp y el PDF o la foto llegan aquí
// por POST, sin descargar, buscar y volver a subir. Funciona en Android
// (Chrome, Edge, Samsung Internet); Safari en iPhone no admite share_target.
//
// Mismas reglas que la subida normal (subirArchivos): sesión, límites del plan,
// tamaños, formatos y duplicados.

import { after, NextResponse, type NextRequest } from "next/server";
import { URL_PUBLICA } from "@/config";
import { repositorioActual } from "@/servidor/auth/sesion";
import { archivosDe, subirArchivos } from "@/servidor/documentos/subir";
import { lanzarCola } from "@/servidor/lectura/cola";

const MAX_CUERPO = 101 * 1024 * 1024; // como el límite de las Server Actions (next.config.ts)

/**
 * Freno a envíos desde otras webs (CSRF). La cookie de sesión es SameSite=Lax
 * y no viaja en un POST de otra web; además, si el navegador dice de dónde
 * viene la petición (Origin) y no es Cuentapp, se rechaza.
 */
function origenPermitido(req: NextRequest): boolean {
  const origen = req.headers.get("origin");
  if (!origen || origen === "null") return true;
  const permitidos = [req.headers.get("host"), req.headers.get("x-forwarded-host"), new URL(URL_PUBLICA).host].filter(Boolean);
  try {
    return permitidos.includes(new URL(origen).host);
  } catch {
    return false;
  }
}

const volver = (req: NextRequest, consulta: string) => NextResponse.redirect(new URL(`/documentos?${consulta}`, req.url), 303);

export async function POST(req: NextRequest) {
  if (!origenPermitido(req)) return new NextResponse("Origen no permitido", { status: 403 });
  if (Number(req.headers.get("content-length") ?? 0) > MAX_CUERPO) return volver(req, "compartir=grande");

  const { repo } = await repositorioActual(); // sin sesión, a /entrar
  let datos: FormData;
  try {
    datos = await req.formData();
  } catch {
    return volver(req, "compartir=error");
  }
  const estado = await subirArchivos(repo, archivosDe(datos));
  if (estado.mensaje) return volver(req, `compartir=error&motivo=${estado.mensaje === "Elige al menos un archivo." ? "vacio" : "limite"}`);

  const resultados = estado.resultados ?? [];
  if (resultados.some((r) => r.ok)) after(lanzarCola);
  const ok = resultados.filter((r) => r.ok).length;
  return volver(req, `compartir=hecho&recibidos=${ok}&rechazados=${resultados.length - ok}`);
}

// Abrir /compartir a mano no hace nada: a la lista de documentos
export async function GET(req: NextRequest) {
  return NextResponse.redirect(new URL("/documentos", req.url), 303);
}
