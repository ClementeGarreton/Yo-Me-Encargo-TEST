-- Migration: Marcar prospectos de clientes frecuentes
-- Date: 2026-06-23
-- Description: Permite marcar en el panel admin (Prospectos) los leads que vienen
--              de clientes frecuentes, para identificarlos y filtrarlos aparte.
--              is_frequent=TRUE muestra un badge "Frecuente" y habilita el filtro.

ALTER TABLE quote_prospects
  ADD COLUMN IF NOT EXISTS is_frequent BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN quote_prospects.is_frequent IS
  'TRUE = lead marcado como cliente frecuente desde el panel admin. Solo afecta visualización/filtros.';

-- Índice parcial para filtrar rápido por clientes frecuentes
CREATE INDEX IF NOT EXISTS idx_quote_prospects_frequent
  ON quote_prospects(is_frequent)
  WHERE is_frequent = TRUE;
