# Comparativa de lectura · banco "sinteticos" · 2026-10-29 0845

Documentos: 12. Criterios y umbrales: docs/pruebas-lectura.md (propuesta, pendiente del documento consolidado).

## Resumen

| Motor | Local | Carga | s/doc | Campos correctos | Errores | Errores confiados | Correcciones | PL-01 | PL-02 | PL-03 | PL-04 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| A · Tesseract 5 (tesseract.js, español) | sí | 0.7 s | 0.51 | 89 % | 3 | 0 | 12 | ✔ | ✖ | ✖ | ✔ |
| B · RapidOCR 3.10 (PP-OCRv6 en ONNX, CPU) | sí | 3.3 s | 2.21 | 93 % | 0 | 0 | 8 | ✔ | ✔ | ✔ | ✔ |
| C · Ollama · qwen2.5vl:7b | sí | omitido: Ollama no está instalado o no está en marcha (descarga no autorizada todavía). | | | | | | | | | |

## Veredicto

Orden según la regla de elección (pruebas superadas → menos errores confiados → más rápido): **B (4/4) > A (2/4)**.

> Resultado provisional: el banco sintético sobrestima la precisión. Repetir con documentos reales antes de decidir.

### B · RapidOCR 3.10 (PP-OCRv6 en ONNX, CPU)

- **PL-01** ✔ supera: 100 % campos correctos en 9 docs (umbral 90 %)
- **PL-02** ✔ supera: fotos: 100 % campos correctos (umbral 75 %) · ilegibles: 0 errores confiados (umbral 0)
- **PL-03** ✔ supera: total 100 % · desglose IVA 100 % · tipo 100 % (umbrales 95 % / 80 % / 90 %)
- **PL-04** ✔ supera: 2.2 s/doc de media (umbral 15 s) · coste 0.00 € · local

| Documento | Correctos | Errores (confiados) | Vacíos | Total | IVA | Tipo | s | Correcciones | Fallos |
|---|---|---|---|---|---|---|---|---|---|
| f04-asesoria | 9/9 | 0 (0) | 0 | ✔ | ✔ | ✔ | 2.85 | 0 | — |
| f05-sin-nif-receptor | 9/9 | 0 (0) | 0 | ✔ | ✔ | ✔ | 1.89 | 0 | — |
| f06-dolares | 9/9 | 0 (0) | 0 | ✔ | ✔ | ✔ | 1.81 | 0 | — |
| f11-nif-erroneo | 9/9 | 0 (0) | 0 | ✔ | ✔ | ✔ | 2.26 | 0 | — |
| t01-cafeteria | 9/9 | 0 (0) | 0 | ✔ | ✔ | ✔ | 2.71 | 0 | — |
| t02-gasolinera | 9/9 | 0 (0) | 0 | ✔ | ✔ | ✔ | 2.58 | 0 | — |
| t03-supermercado | 9/9 | 0 (0) | 0 | ✔ | ✔ | ✔ | 3.31 | 0 | — |
| t07-foto-torcida | 9/9 | 0 (0) | 0 | ✔ | ✔ | ✔ | 2.19 | 0 | — |
| t08-ilegible | 1/9 | 0 (0) | 8 | ✖ | ✖ | ✖ | 0.68 | 8 | tipo: vacio (leído ∅, real ticket_simplificado, conf. 0)<br>nombre_emisor: vacio (leído ∅, real Ferretería Supuesta, conf. 0)<br>nif_emisor: vacio (leído ∅, real B11877305, conf. 0)<br>numero: vacio (leído ∅, real 000915, conf. 0)<br>fecha_emision: vacio (leído ∅, real 2026-08-11, conf. 0)<br>moneda: vacio (leído ∅, real EUR, conf. 0)<br>total_centimos: vacio (leído ∅, real 3000, conf. 0)<br>lineas_iva: vacio (leído ∅, real 21%:2479/521, conf. 0) |
| t09-duplicado-t02 | 9/9 | 0 (0) | 0 | ✔ | ✔ | ✔ | 1.71 | 0 | — |
| t10-descuadre | 9/9 | 0 (0) | 0 | ✔ | ✔ | ✔ | 2.30 | 0 | — |
| t12-fecha-futura | 9/9 | 0 (0) | 0 | ✔ | ✔ | ✔ | 2.29 | 0 | — |

### A · Tesseract 5 (tesseract.js, español)

- **PL-01** ✔ supera: 98 % campos correctos en 9 docs (umbral 90 %)
- **PL-02** ✖ no supera: fotos: 56 % campos correctos (umbral 75 %) · ilegibles: 0 errores confiados (umbral 0)
- **PL-03** ✖ no supera: total 90 % · desglose IVA 90 % · tipo 100 % (umbrales 95 % / 80 % / 90 %)
- **PL-04** ✔ supera: 0.5 s/doc de media (umbral 15 s) · coste 0.00 € · local

| Documento | Correctos | Errores (confiados) | Vacíos | Total | IVA | Tipo | s | Correcciones | Fallos |
|---|---|---|---|---|---|---|---|---|---|
| f04-asesoria | 9/9 | 0 (0) | 0 | ✔ | ✔ | ✔ | 0.82 | 0 | — |
| f05-sin-nif-receptor | 8/9 | 0 (0) | 1 | ✔ | ✔ | ✔ | 0.60 | 1 | numero: vacio (leído ∅, real A-5521, conf. 0) |
| f06-dolares | 9/9 | 0 (0) | 0 | ✔ | ✔ | ✔ | 0.54 | 0 | — |
| f11-nif-erroneo | 9/9 | 0 (0) | 0 | ✔ | ✔ | ✔ | 0.55 | 0 | — |
| t01-cafeteria | 9/9 | 0 (0) | 0 | ✔ | ✔ | ✔ | 0.45 | 0 | — |
| t02-gasolinera | 9/9 | 0 (0) | 0 | ✔ | ✔ | ✔ | 0.45 | 0 | — |
| t03-supermercado | 9/9 | 0 (0) | 0 | ✔ | ✔ | ✔ | 0.65 | 0 | — |
| t07-foto-torcida | 5/9 | 2 (0) | 2 | ✖ | ✖ | ✔ | 0.42 | 4 | nombre_emisor: erroneo (leído nestaurante El Pisto FAEtICIO, real Restaurante El Plato Ficticio, conf. 0.55)<br>numero: erroneo (leído MI2-00877, real M12-00877, conf. 0.59)<br>total_centimos: vacio (leído ∅, real 2002, conf. 0)<br>lineas_iva: vacio (leído ∅, real 10%:1820/182, conf. 0) |
| t08-ilegible | 3/9 | 0 (0) | 6 | ✖ | ✖ | ✔ | 0.09 | 6 | nombre_emisor: vacio (leído ∅, real Ferretería Supuesta, conf. 0)<br>nif_emisor: vacio (leído ∅, real B11877305, conf. 0)<br>numero: vacio (leído ∅, real 000915, conf. 0)<br>fecha_emision: vacio (leído ∅, real 2026-08-11, conf. 0)<br>total_centimos: vacio (leído ∅, real 3000, conf. 0)<br>lineas_iva: vacio (leído ∅, real 21%:2479/521, conf. 0) |
| t09-duplicado-t02 | 9/9 | 0 (0) | 0 | ✔ | ✔ | ✔ | 0.63 | 0 | — |
| t10-descuadre | 9/9 | 0 (0) | 0 | ✔ | ✔ | ✔ | 0.53 | 0 | — |
| t12-fecha-futura | 8/9 | 1 (0) | 0 | ✔ | ✔ | ✔ | 0.42 | 1 | numero: erroneo (leído 1-771, real L-771, conf. 0.73) |

