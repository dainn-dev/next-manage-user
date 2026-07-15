CREATE TABLE chatbot_conversation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT NULLIF(current_setting('app.tenant_id', true), '')::uuid REFERENCES tenant(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    site_id UUID REFERENCES site(id) ON DELETE SET NULL,
    locale VARCHAR(16) NOT NULL DEFAULT 'vi',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE chatbot_message (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT NULLIF(current_setting('app.tenant_id', true), '')::uuid REFERENCES tenant(id) ON DELETE CASCADE,
    conversation_id UUID NOT NULL REFERENCES chatbot_conversation(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(16) NOT NULL CHECK (role IN ('USER','ASSISTANT')),
    redacted_content TEXT NOT NULL,
    model VARCHAR(100),
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE chatbot_tool_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT NULLIF(current_setting('app.tenant_id', true), '')::uuid REFERENCES tenant(id) ON DELETE CASCADE,
    conversation_id UUID NOT NULL REFERENCES chatbot_conversation(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    site_id UUID REFERENCES site(id) ON DELETE SET NULL,
    tool_name VARCHAR(40) NOT NULL,
    filtered_arguments JSONB NOT NULL,
    outcome VARCHAR(20) NOT NULL CHECK (outcome IN ('SUCCESS','DENIED','FAILED')),
    latency_ms BIGINT NOT NULL,
    model VARCHAR(100),
    estimated_cost_micros BIGINT NOT NULL DEFAULT 0,
    error_code VARCHAR(80),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_chatbot_conversation_user ON chatbot_conversation(tenant_id,user_id,updated_at DESC);
CREATE INDEX idx_chatbot_message_retention ON chatbot_message(tenant_id,created_at);
CREATE INDEX idx_chatbot_tool_audit_ops ON chatbot_tool_audit(tenant_id,outcome,created_at DESC);

ALTER TABLE chatbot_conversation ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbot_conversation FORCE ROW LEVEL SECURITY;
ALTER TABLE chatbot_message ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbot_message FORCE ROW LEVEL SECURITY;
ALTER TABLE chatbot_tool_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbot_tool_audit FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON chatbot_conversation USING (tenant_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK (tenant_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid);
CREATE POLICY tenant_isolation ON chatbot_message USING (tenant_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK (tenant_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid);
CREATE POLICY tenant_isolation ON chatbot_tool_audit USING (tenant_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK (tenant_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid);
GRANT SELECT,INSERT,UPDATE,DELETE ON chatbot_conversation,chatbot_message,chatbot_tool_audit TO app_rls,app_admin;

UPDATE billing_plan SET limits=limits||'{"chatbot_messages_month":100}'::jsonb WHERE code='free';
UPDATE billing_plan SET limits=limits||'{"chatbot_messages_month":1000}'::jsonb WHERE code='starter';
UPDATE billing_plan SET limits=limits||'{"chatbot_messages_month":10000}'::jsonb WHERE code='pro';
UPDATE billing_plan SET limits=limits||'{"chatbot_messages_month":null}'::jsonb WHERE code='enterprise';
