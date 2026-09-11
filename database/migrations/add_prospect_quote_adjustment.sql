-- Migration: Ajuste de cotización en prospectos
-- Date: 2026-06-13
-- Description: Permite que el admin ajuste el precio de un lead con un comentario
--              y reenvíe la cotización (50% y 100%) por correo desde el panel de prospectos.

ALTER TABLE quote_prospects
  ADD COLUMN IF NOT EXISTS adjusted_price INTEGER,
  ADD COLUMN IF NOT EXISTS adjustment_comment TEXT,
  ADD COLUMN IF NOT EXISTS quote_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN quote_prospects.adjusted_price IS 'Precio ajustado por el admin (aumento o descuento). Si es NULL se usa total_price.';
COMMENT ON COLUMN quote_prospects.adjustment_comment IS 'Comentario del admin explicando el ajuste de cotización (se incluye en el correo).';
COMMENT ON COLUMN quote_prospects.quote_sent_at IS 'Última vez que se envió la cotización ajustada por correo desde el panel.';
