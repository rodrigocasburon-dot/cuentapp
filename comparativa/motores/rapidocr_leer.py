"""Motor B: RapidOCR (modelos PP-OCR de PaddleOCR ejecutados con ONNX Runtime).

Uso: python rapidocr_leer.py imagen1.png imagen2.png ...
Escribe una línea JSON por imagen en la salida estándar:
  {"archivo": ..., "texto": ..., "confianza": 0..1, "segundos": ...}
y una primera línea {"carga_segundos": ...} con lo que tarda en cargar el modelo.

Se ejecuta UNA vez para todas las imágenes, para no recargar el modelo en
cada documento. Todo ocurre en local: ninguna imagen sale del equipo.
"""

import json
import sys
import time

# Con python -I no se lee PYTHONIOENCODING: forzamos UTF-8 aquí (Windows usa cp1252)
sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

inicio = time.perf_counter()
from rapidocr import RapidOCR  # noqa: E402  (importar cuenta como tiempo de carga)

motor = RapidOCR()
print(json.dumps({"carga_segundos": round(time.perf_counter() - inicio, 3)}), flush=True)


def agrupar_en_lineas(cajas, textos):
    """RapidOCR devuelve trozos de texto sueltos con su caja. Los juntamos en
    líneas: dos trozos van en la misma línea si sus centros verticales están
    a menos de media altura de distancia. Dentro de la línea, de izquierda a
    derecha."""
    trozos = []
    for caja, texto in zip(cajas, textos):
        ys = [p[1] for p in caja]
        xs = [p[0] for p in caja]
        alto = max(ys) - min(ys)
        trozos.append({"y": sum(ys) / 4, "x": min(xs), "alto": max(alto, 1), "texto": texto})
    trozos.sort(key=lambda t: t["y"])
    lineas = []
    for t in trozos:
        if lineas and abs(lineas[-1][-1]["y"] - t["y"]) < 0.5 * t["alto"]:
            lineas[-1].append(t)
        else:
            lineas.append([t])
    return "\n".join(" ".join(t["texto"] for t in sorted(l, key=lambda t: t["x"])) for l in lineas)


for archivo in sys.argv[1:]:
    t0 = time.perf_counter()
    try:
        r = motor(archivo)
        if r.txts:
            texto = agrupar_en_lineas(r.boxes.tolist(), r.txts)
            confianza = sum(r.scores) / len(r.scores)
        else:
            texto, confianza = "", 0.0
    except Exception as e:  # un documento que falla no detiene la comparativa
        texto, confianza = "", 0.0
        print(json.dumps({"archivo": archivo, "error": str(e)}), file=sys.stderr)
    print(
        json.dumps(
            {
                "archivo": archivo,
                "texto": texto,
                "confianza": round(float(confianza), 4),
                "segundos": round(time.perf_counter() - t0, 3),
            },
            ensure_ascii=False,
        ),
        flush=True,
    )
