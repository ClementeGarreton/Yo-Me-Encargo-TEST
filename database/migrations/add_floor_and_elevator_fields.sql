-- Migration: Add floor/elevator fields to bookings and quote_prospects
-- Date: 2026-07-07
-- Description: El piso y si hay ascensor (origen y destino) se capturan en el
-- cotizador y se usan para calcular el precio, pero nunca se guardaban en la
-- base de datos: se perdían antes de llegar al panel admin y a la Orden de
-- Trabajo que reciben los trabajadores.

ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS origin_floor INTEGER,
ADD COLUMN IF NOT EXISTS origin_has_elevator BOOLEAN,
ADD COLUMN IF NOT EXISTS destination_floor INTEGER,
ADD COLUMN IF NOT EXISTS destination_has_elevator BOOLEAN;

ALTER TABLE quote_prospects
ADD COLUMN IF NOT EXISTS origin_floor INTEGER,
ADD COLUMN IF NOT EXISTS origin_has_elevator BOOLEAN,
ADD COLUMN IF NOT EXISTS destination_floor INTEGER,
ADD COLUMN IF NOT EXISTS destination_has_elevator BOOLEAN;

COMMENT ON COLUMN bookings.origin_floor IS 'Piso del domicilio de origen (0 = primer piso/sin escaleras)';
COMMENT ON COLUMN bookings.origin_has_elevator IS 'true si el origen tiene ascensor disponible para la mudanza';
COMMENT ON COLUMN bookings.destination_floor IS 'Piso del domicilio de destino';
COMMENT ON COLUMN bookings.destination_has_elevator IS 'true si el destino tiene ascensor disponible para la mudanza';

COMMENT ON COLUMN quote_prospects.origin_floor IS 'Piso del domicilio de origen (0 = primer piso/sin escaleras)';
COMMENT ON COLUMN quote_prospects.origin_has_elevator IS 'true si el origen tiene ascensor disponible para la mudanza';
COMMENT ON COLUMN quote_prospects.destination_floor IS 'Piso del domicilio de destino';
COMMENT ON COLUMN quote_prospects.destination_has_elevator IS 'true si el destino tiene ascensor disponible para la mudanza';
