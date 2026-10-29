# Documentos reales (no se suben a git)

Aquí van los tickets y facturas reales que aporte el equipo para las pruebas
PL-01..PL-04. Git ignora todo lo que hay en esta carpeta salvo este fichero.

Reglas:

1. **Solo motores locales** (Tesseract, PaddleOCR, Ollama). Nunca se envían a
   un nivel gratuito de un servicio de IA, porque esos niveles pueden usar los
   datos para entrenar.
2. Para el motor D (API de pago) usad solo `../sinteticos/` o documentos
   reales sin ningún dato personal (sin nombres de personas, DNI, tarjetas,
   direcciones particulares).
3. Por cada documento, cread al lado un `<nombre>.json` con la verdad, en el
   mismo formato que `../sinteticos/*.json`.
4. Nombrad los ficheros sin datos personales: `r01-cafeteria.jpg`, no
   `ticket-juan-perez.jpg`.
