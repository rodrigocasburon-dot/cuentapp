-- Migración 11: pagos de planes con Stripe en MODO DE PRUEBAS (D-60).
-- Una fila por pago confirmado. stripe_sesion es UNIQUE: volver a abrir la
-- página de vuelta del pago no activa el plan dos veces. No se guarda ningún
-- dato de tarjeta (los tiene Stripe).
-- No pongas aquí PRAGMA user_version: lo fija migrar() con el número del fichero.

CREATE TABLE pagos (
  id                   TEXT PRIMARY KEY,
  empresa_id           TEXT NOT NULL REFERENCES empresas(id),
  plan_id              TEXT NOT NULL REFERENCES planes(id),
  stripe_sesion        TEXT NOT NULL UNIQUE,      -- id de la sesión de Checkout (cs_test_…)
  stripe_suscripcion   TEXT,                      -- id de la suscripción (sub_…)
  importe_centimos     INTEGER NOT NULL CHECK (importe_centimos >= 0),  -- IVA incluido
  moneda               TEXT NOT NULL CHECK (length(moneda) = 3),
  cancelada_en         TEXT,                      -- al cambiar de plan o darse de baja
  creado_en            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX pagos_empresa ON pagos (empresa_id, creado_en);
