-- FIX: Corregir índice de photo_urls que causa error al crear booking
-- Error: "cannot get array length of a scalar"
-- Fecha: 2025-11-28

-- 1. Eliminar el índice antiguo que causa problemas
DROP INDEX IF EXISTS idx_bookings_has_photos;

-- 2. Crear el nuevo índice que maneja valores NULL correctamente
CREATE INDEX IF NOT EXISTS idx_bookings_has_photos 
ON bookings((CASE WHEN photo_urls IS NOT NULL THEN jsonb_array_length(photo_urls) > 0 ELSE false END));

-- Verificar que se creó correctamente
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'bookings' 
AND indexname = 'idx_bookings_has_photos';
