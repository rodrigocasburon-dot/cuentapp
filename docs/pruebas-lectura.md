# Pruebas de lectura PL-01..PL-04 (fase 2)

> **SUPUESTO.** El documento de decisiones consolidado, que define PL-01..PL-04,
> no está en el repositorio. Estas definiciones y umbrales son una **propuesta**
> razonable para poder medir ya. Cuando llegue el documento, se sustituyen
> aquí y en `comparativa/criterios.ts` y se vuelve a ejecutar la comparativa:
> los resultados en bruto se conservan, solo cambia el veredicto.

## Qué se mide por cada documento y motor

| Métrica | Definición |
|---|---|
| Campos correctos | De los 9 campos clave (tipo, nombre del emisor, NIF del emisor, NIF del receptor, número, fecha, moneda, total, desglose de IVA), cuántos coinciden con la verdad. Un campo que no existe en el documento (p. ej. NIF del receptor en un ticket) es correcto si el motor lo deja vacío. |
| Errores | Campos con un valor **distinto** del real, o inventados (el documento no lo tiene y el motor da un valor). |
| Vacíos | Campos que existen en el documento pero el motor no encontró. |
| Errores confiados | Errores con confianza ≥ 0,8. Son los peligrosos: el usuario no los revisaría. |
| Importes/IVA | Total correcto (sí/no) y desglose de IVA correcto (tipo, base y cuota de cada línea). |
| Tiempo | Segundos por documento, sin contar la carga inicial del motor (se informa aparte). |
| Coste | Euros por documento. Los motores locales cuestan 0 €; para una API se estimaría por precio publicado. |
| Correcciones | Campos que el usuario tendría que tocar: errores + vacíos. |

El nombre del emisor se compara de forma flexible (sin mayúsculas, tildes ni
signos, similitud ≥ 0,85), porque un OCR puede leer "S.L." como "SL".

## Criterios (propuesta)

| Prueba | Qué comprueba | Documentos | Umbral para superarla |
|---|---|---|---|
| **PL-01** | Lectura de documentos limpios | Sintéticos sin degradación, sin el duplicado (9) | ≥ 90 % de campos correctos |
| **PL-02** | Documentos degradados | `t07` (foto torcida) y `t08` (ilegible) | `t07`: ≥ 75 % de campos correctos · `t08`: 0 errores confiados (no debe "inventar" con seguridad) |
| **PL-03** | Importes, IVA y tipo | Todos los legibles (todos menos `t08` y el duplicado) | Total correcto ≥ 95 % · desglose correcto ≥ 80 % · tipo correcto ≥ 90 % |
| **PL-04** | Rendimiento, coste y privacidad | Todos | Tiempo medio ≤ 15 s/documento en este portátil · coste 0 € · ningún dato sale del equipo |

**Regla de elección:** gana el motor que supera más pruebas. Si empatan, el
que tenga menos errores confiados; si siguen empatados, el más rápido.

## Cómo ejecutarla

```bash
npm run comparar                       # banco sintético
npm run comparar -- --banco reales     # tickets reales (solo motores locales)
npm run comparar -- --motores A,B      # elegir motores
```

Motor B necesita su entorno de Python (una vez):

```bash
python -m venv .venv-ocr
.venv-ocr\Scripts\python -m pip install rapidocr==3.10.0 onnxruntime==1.31.1
```

## Resultado del 29/10/2026 (banco sintético, 12 documentos)

Informe completo: `banco-tickets/resultados/sinteticos/2026-10-29_0845/`.

| Motor | s/doc | Campos correctos | Errores (confiados) | PL-01 | PL-02 | PL-03 | PL-04 |
|---|---|---|---|---|---|---|---|
| A · Tesseract 5 | 0,5 | 89 % | 3 (0) | ✔ | ✖ | ✖ | ✔ |
| B · RapidOCR (PP-OCRv6) | 2,2 | 93 % | 0 (0) | ✔ | ✔ | ✔ | ✔ |
| C · Ollama | — | — | — | no medido | | | |

**Elección provisional: motor B (RapidOCR).** Supera las cuatro pruebas y
no comete ningún error; A falla en la foto torcida (lee "Pisto" por "Plato",
"MI2" por "M12", "20,072" por "20,02").

Por qué es provisional:

1. Banco sintético: imágenes limpias, sin arrugas, sombras ni papel térmico.
2. El analizador se ajustó viendo estas mismas salidas (dos reglas: "Nº"
   leído como "Ne"/"N?" y el total en la línea de al lado en fotos
   inclinadas). Hay riesgo de sobreajuste; los tickets reales lo dirán.
3. C no se ha medido.
4. Los umbrales PL son una propuesta.

Ningún motor "inventa" en el documento ilegible (`t08`): dejan los campos
vacíos con confianza 0. En la fase 5, "casi todo vacío" se convertirá en
incidencia `ilegible`.

## Límites conocidos de esta comparativa

- Los documentos sintéticos son limpios y sobrestiman la precisión. **La
  decisión no es firme hasta repetirla con 15-20 tickets reales** en
  `banco-tickets/reales/` (cada uno con su `.json` de verdad).
- Los motores A y B son OCR: devuelven texto, y los campos los saca un
  analizador común (`src/lectura/analizar-texto.ts`). Por eso se mide el
  conjunto "OCR + analizador", y una mejora del analizador mejora a los dos
  por igual.
- El motor C (modelo de visión con Ollama) no se ha medido: el equipo no ha
  autorizado todavía la descarga (unos 7,5 GB). El adaptador está escrito y
  se activa solo si Ollama está en marcha.
- El motor D (API de pago) no se mide: coste cero y sin claves en el repositorio.
