-- Device Ownership and API Keys Migration
-- Adds ownership model and per-device API keys for secure PC service communication
-- Uses irc_ prefix for consistency with existing tables

-- ============================================
-- DEVICE OWNERSHIP COLUMNS
-- ============================================
-- Add ownership tracking to devices
-- owner_type: 'tenant' (tenant owns rig), 'gridpass' (platform owns), 'operator' (third-party)
-- owner_id: Reference to the owner (tenant_id or operator_id)

DO $$
BEGIN
    -- Add owner_type if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'irc_devices' AND column_name = 'owner_type'
    ) THEN
        ALTER TABLE irc_devices ADD COLUMN owner_type TEXT DEFAULT 'tenant' 
            CHECK (owner_type IN ('tenant', 'gridpass', 'operator'));
    END IF;
    
    -- Add owner_id if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'irc_devices' AND column_name = 'owner_id'
    ) THEN
        ALTER TABLE irc_devices ADD COLUMN owner_id UUID;
    END IF;
    
    -- Add assigned_tenant_id for operator-owned rigs
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'irc_devices' AND column_name = 'assigned_tenant_id'
    ) THEN
        ALTER TABLE irc_devices ADD COLUMN assigned_tenant_id UUID REFERENCES irc_tenants(id);
    END IF;
END $$;

-- Create index for ownership queries
CREATE INDEX IF NOT EXISTS idx_irc_devices_owner ON irc_devices(owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_irc_devices_assigned_tenant ON irc_devices(assigned_tenant_id);

-- Add comments
COMMENT ON COLUMN irc_devices.owner_type IS 'Who owns the physical rig: tenant, gridpass, or operator';
COMMENT ON COLUMN irc_devices.owner_id IS 'UUID of the owner (tenant_id for tenant-owned, operator record for operator-owned)';
COMMENT ON COLUMN irc_devices.assigned_tenant_id IS 'Which tenant has access to this rig (for gridpass/operator owned rigs)';

-- ============================================
-- DEVICE API KEYS TABLE
-- ============================================
-- Per-device API keys for secure PC service authentication
-- Each rig gets its own unique key that only allows access to that device's data

CREATE TABLE IF NOT EXISTS irc_device_api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Device reference
    device_id TEXT NOT NULL REFERENCES irc_devices(device_id) ON DELETE CASCADE,
    -- Key details
    name TEXT NOT NULL DEFAULT 'Device Key',
    api_key TEXT NOT NULL UNIQUE,
    -- Key format: irc_device_{device_id}_{random} for easy identification
    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    -- Revocation support
    revoked_at TIMESTAMPTZ,
    revoked_reason TEXT,
    -- Usage tracking
    last_used_at TIMESTAMPTZ,
    last_ip TEXT,
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_irc_device_api_keys_device ON irc_device_api_keys(device_id);
CREATE INDEX IF NOT EXISTS idx_irc_device_api_keys_active ON irc_device_api_keys(api_key) WHERE is_active = true;

-- Add comments
COMMENT ON TABLE irc_device_api_keys IS 'API keys for PC service device authentication';
COMMENT ON COLUMN irc_device_api_keys.api_key IS 'Unique key for device (format: irc_device_{id}_{random})';
COMMENT ON COLUMN irc_device_api_keys.last_ip IS 'Last IP address that used this key';

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_irc_device_api_keys_updated_at ON irc_device_api_keys;
CREATE TRIGGER update_irc_device_api_keys_updated_at
    BEFORE UPDATE ON irc_device_api_keys
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- RIG OPERATORS TABLE (for third-party operators)
-- ============================================
-- Stores information about rig operators who own rigs but assign them to tenants

CREATE TABLE IF NOT EXISTS irc_operators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    -- Contact
    contact_email TEXT,
    contact_name TEXT,
    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    -- Settings
    settings JSONB NOT NULL DEFAULT '{}',
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_irc_operators_slug ON irc_operators(slug);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_irc_operators_updated_at ON irc_operators;
CREATE TRIGGER update_irc_operators_updated_at
    BEFORE UPDATE ON irc_operators
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE irc_operators IS 'Third-party rig operators who own rigs and assign them to tenants';

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Enable RLS on new tables
ALTER TABLE irc_device_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE irc_operators ENABLE ROW LEVEL SECURITY;

-- For now, allow service role full access
CREATE POLICY "Service role full access on device_api_keys"
    ON irc_device_api_keys FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Service role full access on operators"
    ON irc_operators FOR ALL
    USING (true)
    WITH CHECK (true);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to validate device API key and return device info
CREATE OR REPLACE FUNCTION get_device_by_api_key(p_api_key TEXT)
RETURNS TABLE (
    device_id TEXT,
    device_name TEXT,
    owner_type TEXT,
    owner_id UUID,
    assigned_tenant_id UUID,
    company_id UUID
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d.device_id,
        d.name,
        d.owner_type,
        d.owner_id,
        d.assigned_tenant_id,
        d.company_id
    FROM irc_device_api_keys k
    JOIN irc_devices d ON d.device_id = k.device_id
    WHERE k.api_key = p_api_key
      AND k.is_active = true
      AND k.revoked_at IS NULL;
    
    -- Update last_used_at
    UPDATE irc_device_api_keys
    SET last_used_at = NOW()
    WHERE api_key = p_api_key;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to generate a new device API key
CREATE OR REPLACE FUNCTION generate_device_api_key(p_device_id TEXT)
RETURNS TEXT AS $$
DECLARE
    v_key TEXT;
    v_random TEXT;
BEGIN
    -- Generate random suffix
    v_random := encode(gen_random_bytes(16), 'hex');
    -- Format: irc_device_{shortened_device_id}_{random}
    v_key := 'irc_device_' || substring(p_device_id from 1 for 12) || '_' || v_random;
    RETURN v_key;
END;
$$ LANGUAGE plpgsql;

-- Function to register device and create API key
CREATE OR REPLACE FUNCTION register_device_with_key(
    p_device_id TEXT,
    p_name TEXT DEFAULT NULL,
    p_hardware_id TEXT DEFAULT NULL,
    p_tenant_id UUID DEFAULT NULL,
    p_owner_type TEXT DEFAULT 'tenant'
)
RETURNS TABLE (
    device_id TEXT,
    api_key TEXT,
    is_new BOOLEAN
) AS $$
DECLARE
    v_api_key TEXT;
    v_device_exists BOOLEAN;
    v_existing_key TEXT;
BEGIN
    -- Check if device already exists
    SELECT EXISTS(SELECT 1 FROM irc_devices WHERE irc_devices.device_id = p_device_id) INTO v_device_exists;
    
    IF v_device_exists THEN
        -- Device exists, check for existing active key
        SELECT k.api_key INTO v_existing_key
        FROM irc_device_api_keys k
        WHERE k.device_id = p_device_id AND k.is_active = true AND k.revoked_at IS NULL
        LIMIT 1;
        
        IF v_existing_key IS NOT NULL THEN
            -- Return existing key
            RETURN QUERY SELECT p_device_id, v_existing_key, false;
            RETURN;
        END IF;
    ELSE
        -- Create new device
        INSERT INTO irc_devices (device_id, name, hardware_id, company_id, owner_type, status)
        VALUES (
            p_device_id, 
            COALESCE(p_name, 'Rig ' || substring(p_device_id from 5 for 8)),
            p_hardware_id,
            p_tenant_id,
            p_owner_type,
            'offline'
        );
    END IF;
    
    -- Generate new API key
    v_api_key := generate_device_api_key(p_device_id);
    
    -- Insert the key
    INSERT INTO irc_device_api_keys (device_id, api_key, name)
    VALUES (p_device_id, v_api_key, 'Auto-generated key');
    
    RETURN QUERY SELECT p_device_id, v_api_key, NOT v_device_exists;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_device_by_api_key(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_device_by_api_key(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION generate_device_api_key(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION register_device_with_key(TEXT, TEXT, TEXT, UUID, TEXT) TO service_role;

-- Comments
COMMENT ON FUNCTION get_device_by_api_key IS 'Validate device API key and return device info';
COMMENT ON FUNCTION generate_device_api_key IS 'Generate a unique API key for a device';
COMMENT ON FUNCTION register_device_with_key IS 'Register a device and generate/return its API key';

-- ============================================
-- UPDATE EXISTING DEVICES
-- ============================================
-- Set owner_type for existing devices to 'tenant' and link to RevShareRacing

UPDATE irc_devices 
SET 
    owner_type = 'tenant',
    assigned_tenant_id = company_id
WHERE owner_type IS NULL;

