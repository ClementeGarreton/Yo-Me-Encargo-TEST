-- Migration: Add photo URLs to bookings table
-- Date: 2025-11-28
-- Description: Permite guardar las URLs de las fotos subidas por los clientes

-- Add photo_urls field (JSON array)
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS photo_urls JSONB DEFAULT '[]'::jsonb;

-- Add index for better performance on queries with photos (solo si no es null)
CREATE INDEX IF NOT EXISTS idx_bookings_has_photos ON bookings((CASE WHEN photo_urls IS NOT NULL THEN jsonb_array_length(photo_urls) > 0 ELSE false END));

-- Add comment
COMMENT ON COLUMN bookings.photo_urls IS 'Array JSON con URLs de fotos subidas por el cliente desde Supabase Storage';
