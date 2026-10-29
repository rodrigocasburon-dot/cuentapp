-- Migración 7: aceptaciones legales (guía legal, LEG-02, cap. 07).
-- Se guarda QUÉ documento y QUÉ versión aceptó cada usuario, y cuándo (UTC).
-- Sin IP ni otros datos probatorios (minimización). Nunca se borra ni se
-- reescribe: una nueva versión es una fila nueva.
-- No pongas aquí PRAGMA user_version: lo fija migrar() con el número del fichero.

CREATE TABLE aceptaciones_legales (
  id           TEXT PRIMARY KEY,
  usuario_id   TEXT NOT NULL REFERENCES usuarios(id),
  empresa_id   TEXT NOT NULL REFERENCES empresas(id),
  documento    TEXT NOT NULL CHECK (documento IN ('condiciones', 'encargo', 'novedades')),
  version      TEXT NOT NULL,
  aceptado_en  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TRIGGER aceptaciones_legales_inmutables BEFORE UPDATE ON aceptaciones_legales
BEGIN
  SELECT RAISE(ABORT, 'Las aceptaciones legales no se modifican');
END;
