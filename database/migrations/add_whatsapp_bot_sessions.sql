-- Ejecutar en Supabase SQL Editor ANTES de desplegar la nueva versión en Vercel.
-- El nuevo enrutador empieza con TODOS los teléfonos sin autorización para usar OpenAI.
CREATE TABLE IF NOT EXISTS whatsapp_bot_sessions (
  phone TEXT PRIMARY KEY,
  mode TEXT NOT NULL DEFAULT 'idle' CHECK (mode IN ('idle', 'quoting', 'human')),
  greeted_at TIMESTAMPTZ,
  quote_session_id UUID REFERENCES quote_sessions(id) ON DELETE SET NULL,
  activated_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT whatsapp_quoting_requires_activation CHECK (
    mode <> 'quoting' OR (
      quote_session_id IS NOT NULL
      AND activated_at IS NOT NULL
      AND last_activity_at IS NOT NULL
    )
  )
);

-- El webhook utiliza exclusivamente la service_role del backend.
ALTER TABLE whatsapp_bot_sessions ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_whatsapp_bot_mode ON whatsapp_bot_sessions(mode);

-- Idempotencia: los reintentos de Meta no deben duplicar respuestas.
CREATE TABLE IF NOT EXISTS whatsapp_inbound_receipts (
  message_id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE whatsapp_inbound_receipts ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_whatsapp_inbound_receipts_received_at ON whatsapp_inbound_receipts(received_at);

-- Revocar autorización implícita de cotizaciones viejas, sin tocar cotizaciones web.
UPDATE quote_sessions
SET status = 'closed', updated_at = NOW()
WHERE channel = 'whatsapp' AND status IN ('collecting', 'ready');
