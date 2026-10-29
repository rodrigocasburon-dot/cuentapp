-- Migración 10: recuperación de contraseña (RFQ, requisito 1; D-57).
-- Como en las sesiones, solo se guarda el SHA-256 del enlace: quien copie la
-- base de datos no puede usar estas filas. Cada enlace sirve una vez y caduca.
-- No pongas aquí PRAGMA user_version: lo fija migrar() con el número del fichero.

CREATE TABLE recuperaciones (
  id          TEXT PRIMARY KEY CHECK (length(id) = 64),  -- sha256(token) en hexadecimal
  usuario_id  TEXT NOT NULL REFERENCES usuarios(id),
  expira_en   TEXT NOT NULL,
  usada_en    TEXT,
  creada_en   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX recuperaciones_usuario ON recuperaciones (usuario_id);
