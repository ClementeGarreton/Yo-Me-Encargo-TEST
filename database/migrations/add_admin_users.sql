-- Múltiples usuarios para el panel de administración.
--
-- Antes había un único acceso definido por variables de entorno (ADMIN_USERNAME /
-- ADMIN_PASSWORD), y la sesión era anónima: no se podía saber QUIÉN hizo cada cambio.
-- Esta tabla es el prerrequisito de la trazabilidad (ver docs/DISENO_USUARIOS_Y_AUDITORIA.md).
--
-- Todos los usuarios tienen los MISMOS permisos por ahora. La columna is_active permite
-- dar de baja a alguien sin borrar la fila, para que el historial de actividad no quede
-- huérfano.

CREATE TABLE IF NOT EXISTS admin_users (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username             TEXT UNIQUE NOT NULL,        -- email, siempre en minúsculas
  display_name         TEXT NOT NULL,
  -- PBKDF2-SHA256: pbkdf2$<iteraciones>$<salt_b64url>$<hash_b64url>. Nunca texto plano.
  password_hash        TEXT NOT NULL,
  must_change_password BOOLEAN NOT NULL DEFAULT false,
  is_active            BOOLEAN NOT NULL DEFAULT true,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_admin_users_username ON admin_users (username);

COMMENT ON COLUMN admin_users.must_change_password IS
  'Si es true, el panel obliga a cambiar la contraseña antes de operar.';

-- Segundo usuario del panel. Contraseña inicial temporal: debe cambiarla en el primer
-- ingreso (must_change_password = true). El texto plano NO se guarda en el repositorio.
INSERT INTO admin_users (username, display_name, password_hash, must_change_password)
VALUES (
  'cl.garreton21@gmail.com',
  'Cl. Garretón',
  'pbkdf2$210000$FCglJN58fO5HEkRVQrumZg$VhhMjmqXoEW40jHHG4qJCtWUiM4m1L4kJ1aQneIyuz8',
  true
)
ON CONFLICT (username) DO NOTHING;
