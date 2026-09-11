-- Migration: Add parking-to-door distance fields to bookings and quote_prospects
-- Date: 2026-07-12
-- Description: La "distancia del estacionamiento a la puerta" (cuánto hay que acarrear
-- entre el camión y la puerta) se captura en el cotizador (PropertyDetailsStep), pero
-- nunca se guardaba en la base de datos: se perdía antes de llegar al panel admin y a
-- la Orden de Trabajo que reciben los trabajadores. Se guarda como el valor
-- representativo del rango elegido: 0 = en la puerta, 20 = <20m, 40 = 20-40m, 60 = >40m.

ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS origin_parking_distance INTEGER,
ADD COLUMN IF NOT EXISTS destination_parking_distance INTEGER;

ALTER TABLE quote_prospects
ADD COLUMN IF NOT EXISTS origin_parking_distance INTEGER,
ADD COLUMN IF NOT EXISTS destination_parking_distance INTEGER;

COMMENT ON COLUMN bookings.origin_parking_distance IS 'Distancia estacionamiento->puerta en origen (0=en la puerta, 20=<20m, 40=20-40m, 60=>40m)';
COMMENT ON COLUMN bookings.destination_parking_distance IS 'Distancia estacionamiento->puerta en destino (0=en la puerta, 20=<20m, 40=20-40m, 60=>40m)';

COMMENT ON COLUMN quote_prospects.origin_parking_distance IS 'Distancia estacionamiento->puerta en origen (0=en la puerta, 20=<20m, 40=20-40m, 60=>40m)';
COMMENT ON COLUMN quote_prospects.destination_parking_distance IS 'Distancia estacionamiento->puerta en destino (0=en la puerta, 20=<20m, 40=20-40m, 60=>40m)';
