-- Migration: Add Flow payment fields to bookings table
-- Run this in your Supabase SQL editor

-- Add Flow payment tracking columns
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS flow_token VARCHAR(255),
ADD COLUMN IF NOT EXISTS flow_order BIGINT,
ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS payment_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(100);

-- Add index for faster lookups by flow_token
CREATE INDEX IF NOT EXISTS idx_bookings_flow_token ON bookings(flow_token);

-- Add index for payment_status
CREATE INDEX IF NOT EXISTS idx_bookings_payment_status ON bookings(payment_status);

-- Add comment to columns
COMMENT ON COLUMN bookings.flow_token IS 'Token de la transacción de Flow';
COMMENT ON COLUMN bookings.flow_order IS 'Número de orden de Flow';
COMMENT ON COLUMN bookings.payment_status IS 'Estado del pago: pending, approved, rejected, cancelled';
COMMENT ON COLUMN bookings.payment_date IS 'Fecha de confirmación del pago';
COMMENT ON COLUMN bookings.payment_method IS 'Método de pago usado (webpay, credit_card, transfer, etc.)';
