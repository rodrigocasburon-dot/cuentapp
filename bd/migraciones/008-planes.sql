-- Migración 8: planes (decisión del equipo, 29/10/2026, D-55).
--   Cuentapp: 20 €/mes, ahora hasta 100 documentos al mes (antes 250).
--   Cuentapp Pro (nuevo): 40 €/mes, hasta 300 documentos al mes.
--
-- La tabla planes del esquema base solo admitía los ids 'prueba', 'cuentapp' y
-- 'despacho' (CHECK). SQLite no permite cambiar un CHECK, así que se rehace la
-- tabla: copia temporal → borrar → crear sin ese CHECK → volver a llenar.
-- empresas.plan_id apunta a «planes» por nombre, así que apunta a la nueva.
-- Las claves foráneas se comprueban al confirmar la transacción
-- (defer_foreign_keys): para entonces los planes ya vuelven a existir.
-- No pongas aquí PRAGMA user_version: lo fija migrar() con el número del fichero.

PRAGMA defer_foreign_keys = ON;

CREATE TEMP TABLE planes_copia AS SELECT * FROM planes;
DROP TABLE planes;

CREATE TABLE planes (
  id                TEXT PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 30),
  nombre            TEXT    NOT NULL,
  precio_centimos   INTEGER NOT NULL CHECK (precio_centimos >= 0),  -- sin IVA, al mes
  limite_docs_mes   INTEGER,          -- NULL = sin límite definido (Despacho)
  limite_docs_total INTEGER,          -- solo Prueba: 30 documentos en total
  dias_prueba       INTEGER,          -- solo Prueba: 14 días
  disponible        INTEGER NOT NULL DEFAULT 1 CHECK (disponible IN (0, 1))  -- Despacho = 0 ("próximamente")
);

INSERT INTO planes SELECT id, nombre, precio_centimos, limite_docs_mes, limite_docs_total, dias_prueba, disponible FROM planes_copia;
DROP TABLE planes_copia;

UPDATE planes SET limite_docs_mes = 100 WHERE id = 'cuentapp';

-- En una base nueva la tabla aún está vacía: insertarPlanes() crea todos los
-- planes después. Aquí solo se añade Pro si ya hay planes (base existente).
INSERT INTO planes (id, nombre, precio_centimos, limite_docs_mes, limite_docs_total, dias_prueba, disponible)
SELECT 'pro', 'Cuentapp Pro', 4000, 300, NULL, NULL, 1
WHERE EXISTS (SELECT 1 FROM planes) AND NOT EXISTS (SELECT 1 FROM planes WHERE id = 'pro');
