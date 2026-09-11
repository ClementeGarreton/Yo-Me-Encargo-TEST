-- MVP 1.3: sesiones de cotización omnicanal + auditoría de conversaciones IA
-- Aplicar en Supabase antes de activar WhatsApp Cloud API.

CREATE TABLE IF NOT EXISTS quote_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resume_token TEXT NOT NULL UNIQUE,
  channel TEXT NOT NULL DEFAULT 'web' CHECK (channel IN ('web', 'whatsapp')),
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'collecting' CHECK (status IN ('collecting', 'ready', 'quoted', 'handoff', 'closed')),
  current_section INTEGER NOT NULL DEFAULT 1 CHECK (current_section BETWEEN 1 AND 7),
  state JSONB NOT NULL DEFAULT '{}'::jsonb,
  quote_id TEXT,
  prospect_id UUID,
  estimated_price INTEGER,
  total_volume NUMERIC(10,2),
  total_weight NUMERIC(10,2),
  total_distance NUMERIC(10,2),
  recommended_vehicle TEXT,
  pdf_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quote_sessions_phone ON quote_sessions(phone);
CREATE INDEX IF NOT EXISTS idx_quote_sessions_status ON quote_sessions(status);
CREATE INDEX IF NOT EXISTS idx_quote_sessions_updated_at ON quote_sessions(updated_at DESC);

CREATE TABLE IF NOT EXISTS ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel TEXT NOT NULL CHECK (channel IN ('web', 'whatsapp')),
  external_user_id TEXT,
  customer_name TEXT,
  quote_session_id UUID REFERENCES quote_sessions(id) ON DELETE SET NULL,
  quote_id TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'quoted', 'handoff', 'closed', 'error')),
  converted BOOLEAN NOT NULL DEFAULT FALSE,
  input_tokens BIGINT NOT NULL DEFAULT 0,
  output_tokens BIGINT NOT NULL DEFAULT 0,
  estimated_ai_cost_usd NUMERIC(12,6) NOT NULL DEFAULT 0,
  model TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_channel ON ai_conversations(channel);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_status ON ai_conversations(status);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_last_message ON ai_conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_external_user ON ai_conversations(external_user_id);

CREATE TABLE IF NOT EXISTS ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL DEFAULT '',
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'document', 'interactive', 'system')),
  external_message_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_messages_external_message_id
  ON ai_messages(external_message_id)
  WHERE external_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation_created
  ON ai_messages(conversation_id, created_at ASC);

CREATE TABLE IF NOT EXISTS ai_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  structured_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  success BOOLEAN NOT NULL DEFAULT TRUE,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_actions_conversation_created
  ON ai_actions(conversation_id, created_at ASC);

-- Estas tablas sólo se consumen desde el backend con service_role y desde APIs admin autenticadas.
ALTER TABLE quote_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_actions ENABLE ROW LEVEL SECURITY;

-- El lead generado por WhatsApp usa el mismo CRM de prospectos.
ALTER TABLE quote_prospects DROP CONSTRAINT IF EXISTS quote_prospects_source_check;
ALTER TABLE quote_prospects
  ADD CONSTRAINT quote_prospects_source_check
  CHECK (source IN ('web', 'pdf_download', 'email_quote', 'checkout_initiated', 'domicilio', 'whatsapp'));
