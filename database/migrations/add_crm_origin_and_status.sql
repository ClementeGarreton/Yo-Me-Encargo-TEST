-- Migration: CRM — ampliar orígenes y estados de prospectos
-- Date: 2026-06-15
-- Description:
--   #1 Permite marcar el origen del lead como RRSS o Recomendación (además de los automáticos).
--   #2 Agrega el estado 'no_response' (Sin respuesta) al flujo del lead.

-- Origen del lead: agregar 'rrss' y 'recomendacion'
ALTER TABLE quote_prospects DROP CONSTRAINT IF EXISTS quote_prospects_source_check;
ALTER TABLE quote_prospects ADD CONSTRAINT quote_prospects_source_check
  CHECK (source IN ('web', 'pdf_download', 'email_quote', 'checkout_initiated', 'domicilio', 'rrss', 'recomendacion'));

-- Estado del lead: agregar 'no_response'
ALTER TABLE quote_prospects DROP CONSTRAINT IF EXISTS quote_prospects_status_check;
ALTER TABLE quote_prospects ADD CONSTRAINT quote_prospects_status_check
  CHECK (status IN ('new', 'contacted', 'no_response', 'converted', 'lost'));
