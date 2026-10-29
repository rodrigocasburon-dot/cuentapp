"""Servicio de lectura (motor B: RapidOCR) para la app.

Se arranca UNA vez y se queda esperando: así el modelo se carga una sola vez
(~3 s) y cada documento tarda solo lo que cuesta leerlo.

Protocolo: una línea JSON por petición en la entrada estándar
    {"id": 1, "ruta": "C:/.../originales/<empresa>/<hash>.pdf"}
y una línea JSON por respuesta en la salida estándar
    {"id": 1, "texto": "...", "confianza": 0.93, "fuente": "ocr" | "pdf-texto", "segundos": 1.2}
    {"id": 1, "error": "..."}

PDF: si el PDF tiene texto (factura generada por un programa), se usa ese
texto directamente: es exacto. Si no lo tiene (PDF escaneado), se convierten
sus páginas en imagen y se pasan por el OCR. Como máximo 3 páginas.

Todo ocurre en local: ningún documento sale del equipo.
"""

import json
import sys
import time

sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

import pypdfium2 as pdfium  # noqa: E402
from rapidocr import RapidOCR  # noqa: E402

MAX_PAGINAS = 3
MIN_CARACTERES_TEXTO = 30  # menos que esto en un PDF = probablemente escaneado
motor = RapidOCR()


def agrupar_en_lineas(cajas, textos):
    """Junta los trozos que devuelve el OCR en líneas (misma altura), de
    izquierda a derecha. Igual que en comparativa/motores/rapidocr_leer.py."""
    trozos = []
    for caja, texto in zip(cajas, textos):
        ys = [p[1] for p in caja]
        xs = [p[0] for p in caja]
        trozos.append({"y": sum(ys) / 4, "x": min(xs), "alto": max(max(ys) - min(ys), 1), "texto": texto})
    trozos.sort(key=lambda t: t["y"])
    lineas = []
    for t in trozos:
        if lineas and abs(lineas[-1][-1]["y"] - t["y"]) < 0.5 * t["alto"]:
            lineas[-1].append(t)
        else:
            lineas.append([t])
    return "\n".join(" ".join(t["texto"] for t in sorted(l, key=lambda t: t["x"])) for l in lineas)


def ocr(imagen):
    """Devuelve (texto, confianza media)."""
    r = motor(imagen)
    if not r.txts:
        return "", 0.0
    return agrupar_en_lineas(r.boxes.tolist(), r.txts), float(sum(r.scores) / len(r.scores))


def leer_pdf(ruta):
    pdf = pdfium.PdfDocument(ruta)
    try:
        paginas = [pdf[i] for i in range(min(len(pdf), MAX_PAGINAS))]
        texto = "\n".join(p.get_textpage().get_text_range() for p in paginas)
        if len(texto.strip()) >= MIN_CARACTERES_TEXTO:
            return texto, 0.98, "pdf-texto"
        # Escaneado: cada página a imagen (200 ppp) y OCR
        partes, confianzas = [], []
        for p in paginas:
            imagen = p.render(scale=200 / 72).to_numpy()
            t, c = ocr(imagen)
            partes.append(t)
            confianzas.append(c)
        return "\n".join(partes), (sum(confianzas) / len(confianzas) if confianzas else 0.0), "ocr"
    finally:
        pdf.close()


def leer(ruta):
    if ruta.lower().endswith(".pdf"):
        return leer_pdf(ruta)
    texto, confianza = ocr(ruta)
    return texto, confianza, "ocr"


print(json.dumps({"listo": True}), flush=True)
for linea in sys.stdin:
    if not linea.strip():
        continue
    peticion = json.loads(linea)
    t0 = time.perf_counter()
    try:
        texto, confianza, fuente = leer(peticion["ruta"])
        respuesta = {"id": peticion["id"], "texto": texto, "confianza": round(confianza, 4), "fuente": fuente}
    except Exception as e:  # un documento roto no tumba el servicio
        respuesta = {"id": peticion["id"], "error": f"{type(e).__name__}: {e}"}
    respuesta["segundos"] = round(time.perf_counter() - t0, 3)
    print(json.dumps(respuesta, ensure_ascii=False), flush=True)
