-- Persistir vehículos individuales (con estado activo/mantenimiento) en fleet_config.
-- Antes: los vehículos eran mock generados en el navegador y "mantenimiento" no se
-- guardaba, por lo que no afectaba la disponibilidad. Ahora el estado vive en la BD y
-- la capacidad para el cotizador = número de vehículos ACTIVOS.
--
-- Estructura de cada elemento de `vehicles`:
--   { "id": number, "name": string, "capacity": number,
--     "driver": string, "phone": string, "status": "active" | "maintenance" }

ALTER TABLE fleet_config
  ADD COLUMN IF NOT EXISTS vehicles JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Backfill: crear un vehículo ACTIVO por cada num_vehicles en filas que aún no tienen
-- vehículos, para no cambiar el comportamiento actual hasta que se edite la flota.
UPDATE fleet_config
SET vehicles = (
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', gs,
      'name', 'Camión ' || gs,
      'capacity', 1,
      'driver', '',
      'phone', '',
      'status', 'active'
    )
    ORDER BY gs
  )
  FROM generate_series(1, GREATEST(num_vehicles, 1)) AS gs
)
WHERE vehicles IS NULL OR vehicles = '[]'::jsonb;
