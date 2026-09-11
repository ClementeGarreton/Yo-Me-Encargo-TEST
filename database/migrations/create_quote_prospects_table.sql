-- Migration: Create quote_prospects table for tracking leads/prospects
-- Date: 2026-03-17
-- Description: Tabla separada de bookings para guardar todas las cotizaciones como prospectos,
--              permitiendo contactar a personas que cotizaron pero no pagaron.

CREATE TABLE IF NOT EXISTS quote_prospects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id TEXT,
  source TEXT NOT NULL DEFAULT 'web' CHECK (source IN ('web', 'pdf_download', 'email_quote', 'checkout_initiated', 'domicilio')),

  -- Datos de contacto
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  is_company BOOLEAN DEFAULT FALSE,
  company_name TEXT,
  company_rut TEXT,

  -- Datos de cotización
  origin_address TEXT,
  destination_address TEXT,
  visit_address TEXT,
  scheduled_date DATE,
  scheduled_time TIME,
  total_price INTEGER,
  original_price INTEGER,
  is_flexible BOOLEAN DEFAULT FALSE,
  recommended_vehicle TEXT,
  total_volume NUMERIC(10,2),
  total_weight NUMERIC(10,2),
  total_distance NUMERIC(10,2),

  -- Resumen compacto de items y servicios (JSON)
  items_summary JSONB,
  additional_services JSONB,

  -- Estado del lead
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'converted', 'lost')),
  notes TEXT,

  -- Relación con booking si se convierte
  converted_booking_id UUID,

  -- PDF de la cotización
  pdf_url TEXT,
  pdf_generated_at TIMESTAMPTZ,

  -- Clave única para evitar duplicados (email + fecha + origen + destino)
  lead_key TEXT UNIQUE,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_prospects_status ON quote_prospects(status);
CREATE INDEX IF NOT EXISTS idx_prospects_email ON quote_prospects(email);
CREATE INDEX IF NOT EXISTS idx_prospects_created_at ON quote_prospects(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prospects_source ON quote_prospects(source);
CREATE INDEX IF NOT EXISTS idx_prospects_lead_key ON quote_prospects(lead_key);

-- Comments
COMMENT ON TABLE quote_prospects IS 'Prospectos/leads generados desde el cotizador. Separado de bookings.';
COMMENT ON COLUMN quote_prospects.source IS 'Origen del lead: web, pdf_download, email_quote, checkout_initiated, domicilio';
COMMENT ON COLUMN quote_prospects.lead_key IS 'Clave única para upsert y evitar duplicados del mismo prospecto';
COMMENT ON COLUMN quote_prospects.items_summary IS 'JSON compacto con resumen de items: [{name, quantity, volume}]';
COMMENT ON COLUMN quote_prospects.converted_booking_id IS 'UUID del booking si el prospecto se convirtió en reserva pagada';
