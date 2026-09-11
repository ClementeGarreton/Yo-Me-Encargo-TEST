-- Migration: Pre-reservas provisionales (no consumen cupo hasta que se paga)
-- Date: 2026-06-10
-- Description: Al enviar la cotización por correo se genera la orden Flow y un booking
--              "provisional". Ese booking NO debe ocupar cupo de flota hasta que Flow
--              confirma el pago. is_provisional=TRUE lo excluye del conteo de capacidad;
--              el webhook de Flow lo pone en FALSE + status='confirmed' al aprobarse el pago.

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS is_provisional BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN bookings.is_provisional IS
  'TRUE = pre-reserva creada al enviar/iniciar la cotización, aún sin pago confirmado. No consume cupo de flota hasta que el webhook de Flow confirma el pago (pasa a FALSE + status=confirmed).';

-- Índice parcial para barrer pre-reservas que nunca se pagaron (limpieza futura)
CREATE INDEX IF NOT EXISTS idx_bookings_provisional
  ON bookings(is_provisional, created_at)
  WHERE is_provisional = TRUE;
