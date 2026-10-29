-- Migración 9: categoría del gasto (RFQ, requisito 3; D-56).
-- La sugiere la lectura con palabras clave (src/dominio/categorias.ts) y el
-- usuario la corrige en la ficha. NULL = sin categoría. Sin CHECK con la
-- lista: la valida zod, y así añadir una categoría no exige rehacer la tabla.
-- No pongas aquí PRAGMA user_version: lo fija migrar() con el número del fichero.

ALTER TABLE documentos ADD COLUMN categoria TEXT CHECK (categoria IS NULL OR length(categoria) BETWEEN 1 AND 30);
