-- Migration: Add booking type and home service fields to bookings table
-- Date: 2025-11-30
-- Description: Agrega campos para distinguir entre cotizaciones online y a domicilio

-- Add booking_type to distinguish between online and home service quotes
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS booking_type VARCHAR(20) DEFAULT 'online' CHECK (booking_type IN ('online', 'domicilio')),
ADD COLUMN IF NOT EXISTS service_completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS visit_address TEXT;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_bookings_booking_type ON bookings(booking_type);
CREATE INDEX IF NOT EXISTS idx_bookings_service_completed ON bookings(booking_type, status) WHERE booking_type = 'domicilio';

-- Add comments
COMMENT ON COLUMN bookings.booking_type IS 'Tipo de reserva: online (mudanza completa) o domicilio (visita a domicilio para cotizar)';
COMMENT ON COLUMN bookings.service_completed_at IS 'Fecha y hora en que se completó el servicio a domicilio';
COMMENT ON COLUMN bookings.visit_address IS 'Dirección donde se realizará la visita a domicilio para cotizar';

-- Update existing records to have online type
UPDATE bookings SET booking_type = 'online' WHERE booking_type IS NULL;
