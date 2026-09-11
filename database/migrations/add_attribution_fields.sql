-- Migration: Add Google Ads attribution fields to conversion tables
-- Date: 2026-07-19
-- Description: Guarda el identificador de clic de Google Ads (gclid) y parametros de
--              campana en las tablas de conversion para poder cerrar la cadena
--              clic -> cotizacion -> reserva -> pago -> campana en el dashboard de
--              atribucion de Vanlook (data.vanlookstudio.com).
--
--              La columna critica es `gclid` (la que lee el dashboard hoy). Las demas
--              son para cobertura futura (iOS gbraid/wbraid y reporting por UTM).
--
-- Idempotente: se puede correr varias veces sin error.

ALTER TABLE quote_prospects
  ADD COLUMN IF NOT EXISTS gclid text,
  ADD COLUMN IF NOT EXISTS gbraid text,
  ADD COLUMN IF NOT EXISTS wbraid text,
  ADD COLUMN IF NOT EXISTS utm_source text,
  ADD COLUMN IF NOT EXISTS utm_campaign text;

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS gclid text,
  ADD COLUMN IF NOT EXISTS gbraid text,
  ADD COLUMN IF NOT EXISTS wbraid text,
  ADD COLUMN IF NOT EXISTS utm_source text,
  ADD COLUMN IF NOT EXISTS utm_campaign text;

CREATE INDEX IF NOT EXISTS quote_prospects_gclid_idx ON quote_prospects (gclid) WHERE gclid IS NOT NULL;
CREATE INDEX IF NOT EXISTS bookings_gclid_idx ON bookings (gclid) WHERE gclid IS NOT NULL;

COMMENT ON COLUMN quote_prospects.gclid IS 'Google Ads click id (auto-tagging). Une el clic con la conversion en el dashboard de atribucion.';
COMMENT ON COLUMN bookings.gclid IS 'Google Ads click id (auto-tagging). Une la reserva pagada con la campana para calcular ROAS.';
