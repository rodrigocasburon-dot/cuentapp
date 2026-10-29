#!/usr/bin/env bash
# Preparación del codespace (se ejecuta una vez, al crearlo).
set -e

npm ci

# Base de datos con las dos empresas de prueba (solo si aún no existe)
if [ ! -f datos/cuentapp.db ]; then npm run db:reset; fi

# Lectura automática. Si falla, la app funciona igual: los documentos pasan a
# revisión manual y los datos se escriben a mano.
if [ ! -d .venv-ocr ]; then
  python -m venv .venv-ocr && \
  .venv-ocr/bin/pip install --quiet rapidocr==3.10.0 onnxruntime==1.31.1 pypdfium2==5.14.0 \
  || echo "AVISO: no se ha podido instalar la lectura automática (OCR)."
fi

echo "Cuentapp lista. Se abrirá en el puerto 3000."
