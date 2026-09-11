-- Log de actividad del panel: quién hizo qué y cuándo.
-- Diseño completo en docs/DISENO_USUARIOS_Y_AUDITORIA.md
--
-- Depende de add_admin_users.sql (de ahí sale la identidad del actor).

CREATE TABLE IF NOT EXISTS admin_activity_log (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),   -- fecha y hora del movimiento

  actor_username TEXT NOT NULL,        -- QUIÉN
  -- Sin FK a admin_users a propósito: si un usuario se elimina, el historial debe
  -- sobrevivir. Para dar de baja a alguien se usa admin_users.is_active.
  actor_id       TEXT,

  action         TEXT NOT NULL,        -- QUÉ: booking.status_changed, prospect.deleted, ...
  entity_type    TEXT,                 -- booking | prospect | fleet | pricing | auth | ...
  entity_id      TEXT,
  -- Etiqueta legible duplicada a propósito: permite leer el log aunque el registro
  -- original ya no exista.
  entity_label   TEXT,

  summary        TEXT NOT NULL,        -- frase lista para mostrar
  changes        JSONB,                -- { campo: { from, to } }, solo lo que cambió

  ip             TEXT,
  user_agent     TEXT,
  request_path   TEXT,
  result         TEXT NOT NULL DEFAULT 'success'   -- success | denied | error
);

CREATE INDEX IF NOT EXISTS idx_activity_created ON admin_activity_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_actor   ON admin_activity_log (actor_username, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_entity  ON admin_activity_log (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_action  ON admin_activity_log (action, created_at DESC);

COMMENT ON TABLE admin_activity_log IS
  'Trazabilidad de acciones del panel. Solo lectura desde la interfaz: no se edita ni se borra por registro. Retención 12 meses (limpieza en el cron cleanup-bookings).';
