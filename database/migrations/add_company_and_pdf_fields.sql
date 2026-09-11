-- Migration: Add company billing fields and PDF storage to bookings table
-- Date: 2025-11-28

-- Add company/billing fields
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS is_company BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS company_name TEXT,
ADD COLUMN IF NOT EXISTS company_rut TEXT,
ADD COLUMN IF NOT EXISTS pdf_url TEXT,
ADD COLUMN IF NOT EXISTS pdf_generated_at TIMESTAMPTZ;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_bookings_is_company ON bookings(is_company);
CREATE INDEX IF NOT EXISTS idx_bookings_company_name ON bookings(company_name);

-- Add comments
COMMENT ON COLUMN bookings.is_company IS 'Indica si el cliente necesita factura';
COMMENT ON COLUMN bookings.company_name IS 'Razón social de la empresa para facturación';
COMMENT ON COLUMN bookings.company_rut IS 'RUT de la empresa para facturación';
COMMENT ON COLUMN bookings.pdf_url IS 'URL del PDF de confirmación almacenado en Supabase Storage';
COMMENT ON COLUMN bookings.pdf_generated_at IS 'Fecha y hora de generación del PDF';
