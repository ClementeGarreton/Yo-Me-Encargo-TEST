-- Token para el link público de choferes (solo lectura, sin precios).
-- Es un único token común para todos los choferes; regenerarlo invalida el link anterior.
-- El link vive en: /trabajos/<driver_access_token>

ALTER TABLE fleet_config
  ADD COLUMN IF NOT EXISTS driver_access_token TEXT;
