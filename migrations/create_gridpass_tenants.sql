-- GridPass Multi-Tenant Support Migration
-- This creates the tenant management tables for the GridPass platform
-- Uses irc_ prefix for consistency with existing tables

-- ============================================
-- TENANTS TABLE
-- ============================================
-- Stores tenant/company information for multi-tenant support
-- Each tenant (like RevShareRacing) gets their own entry
-- Note: This extends the existing irc_companies table concept

CREATE TABLE IF NOT EXISTS irc_tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    -- Contact information
    contact_email TEXT,
    contact_name TEXT,
    -- Billing/subscription info
    plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'pro', 'enterprise')),
    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    -- Custom settings (JSON for flexibility)
    settings JSONB NOT NULL DEFAULT '{}',
    -- Branding
    logo_url TEXT,
    primary_color TEXT,
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_irc_tenants_slug ON irc_tenants(slug);
CREATE INDEX IF NOT EXISTS idx_irc_tenants_active ON irc_tenants(is_active) WHERE is_active = true;

-- Add comments
COMMENT ON TABLE irc_tenants IS 'GridPass platform tenants (companies using the platform)';
COMMENT ON COLUMN irc_tenants.slug IS 'URL-friendly identifier (e.g., revshareracing)';
COMMENT ON COLUMN irc_tenants.plan IS 'Subscription plan: free, starter, pro, enterprise';
COMMENT ON COLUMN irc_tenants.settings IS 'Tenant-specific configuration as JSON';

-- ============================================
-- API KEYS TABLE
-- ============================================
-- Stores API keys for tenant authentication

CREATE TABLE IF NOT EXISTS irc_api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES irc_tenants(id) ON DELETE CASCADE,
    -- Key details
    name TEXT NOT NULL,
    api_key TEXT NOT NULL UNIQUE,
    -- In production, you'd store a hash instead of the plaintext key
    -- api_key_hash TEXT NOT NULL UNIQUE,
    -- Permissions/scopes
    scopes TEXT[] NOT NULL DEFAULT ARRAY['read', 'write'],
    -- Rate limiting
    rate_limit_per_minute INTEGER NOT NULL DEFAULT 1000,
    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    -- Expiration (optional)
    expires_at TIMESTAMPTZ,
    -- Audit
    last_used_at TIMESTAMPTZ,
    created_by UUID REFERENCES auth.users(id),
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_irc_api_keys_tenant ON irc_api_keys(tenant_id);
CREATE INDEX IF NOT EXISTS idx_irc_api_keys_active ON irc_api_keys(api_key) WHERE is_active = true;

-- Add comments
COMMENT ON TABLE irc_api_keys IS 'API keys for tenant authentication';
COMMENT ON COLUMN irc_api_keys.api_key IS 'The API key value (pass in X-Tenant-Key header)';
COMMENT ON COLUMN irc_api_keys.scopes IS 'Allowed operations: read, write, admin';
COMMENT ON COLUMN irc_api_keys.rate_limit_per_minute IS 'Max API calls per minute';

-- ============================================
-- UPDATED_AT TRIGGERS
-- ============================================

-- Reuse existing update_updated_at_column function if it exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for irc_tenants
DROP TRIGGER IF EXISTS update_irc_tenants_updated_at ON irc_tenants;
CREATE TRIGGER update_irc_tenants_updated_at
    BEFORE UPDATE ON irc_tenants
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for irc_api_keys
DROP TRIGGER IF EXISTS update_irc_api_keys_updated_at ON irc_api_keys;
CREATE TRIGGER update_irc_api_keys_updated_at
    BEFORE UPDATE ON irc_api_keys
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Enable RLS
ALTER TABLE irc_tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE irc_api_keys ENABLE ROW LEVEL SECURITY;

-- Tenants: Only admins can manage tenants
-- For now, allow service role full access
CREATE POLICY "Service role full access on tenants"
    ON irc_tenants FOR ALL
    USING (true)
    WITH CHECK (true);

-- API Keys: Only admins can manage API keys
CREATE POLICY "Service role full access on api_keys"
    ON irc_api_keys FOR ALL
    USING (true)
    WITH CHECK (true);

-- ============================================
-- LINK EXISTING TABLES TO TENANTS
-- ============================================

-- Add tenant_id to irc_devices if it doesn't exist
-- This uses the existing company_id as the tenant link
DO $$
BEGIN
    -- Check if company_id already exists (it should based on existing schema)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'irc_devices' AND column_name = 'company_id'
    ) THEN
        ALTER TABLE irc_devices ADD COLUMN company_id UUID REFERENCES irc_tenants(id);
        CREATE INDEX idx_irc_devices_company ON irc_devices(company_id);
    END IF;
END $$;

-- Add tenant association to user profiles
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'irc_user_profiles' AND column_name = 'default_tenant_id'
    ) THEN
        ALTER TABLE irc_user_profiles ADD COLUMN default_tenant_id UUID REFERENCES irc_tenants(id);
    END IF;
END $$;

-- ============================================
-- SEED DEFAULT TENANT (RevShareRacing)
-- ============================================

-- Insert RevShareRacing as the default tenant
INSERT INTO irc_tenants (id, name, slug, description, plan, settings)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'Rev Share Racing',
    'revshareracing',
    'The original GridPass tenant - shared sim racing experiences',
    'enterprise',
    '{"theme": "racing", "features": ["queue", "leaderboards", "credits"]}'
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    updated_at = NOW();

-- Create a default API key for RevShareRacing (for development/testing)
-- In production, you would generate this securely
INSERT INTO irc_api_keys (tenant_id, name, api_key, scopes)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'Development Key',
    'irc_dev_revshareracing_key_12345',
    ARRAY['read', 'write']
)
ON CONFLICT (api_key) DO NOTHING;

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to get tenant by API key
CREATE OR REPLACE FUNCTION get_tenant_by_api_key(p_api_key TEXT)
RETURNS TABLE (
    tenant_id UUID,
    tenant_name TEXT,
    tenant_slug TEXT,
    is_active BOOLEAN,
    scopes TEXT[]
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.id,
        t.name,
        t.slug,
        t.is_active,
        k.scopes
    FROM irc_api_keys k
    JOIN irc_tenants t ON t.id = k.tenant_id
    WHERE k.api_key = p_api_key
      AND k.is_active = true
      AND (k.expires_at IS NULL OR k.expires_at > NOW())
      AND t.is_active = true;
    
    -- Update last_used_at
    UPDATE irc_api_keys
    SET last_used_at = NOW()
    WHERE api_key = p_api_key;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_tenant_by_api_key(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_tenant_by_api_key(TEXT) TO service_role;

COMMENT ON FUNCTION get_tenant_by_api_key IS 'Validate API key and return tenant info';

