-- Add system information columns to irc_devices table
-- These columns store PC hardware and system information collected from the client

ALTER TABLE irc_devices
ADD COLUMN IF NOT EXISTS os_name TEXT,
ADD COLUMN IF NOT EXISTS os_version TEXT,
ADD COLUMN IF NOT EXISTS os_arch TEXT,
ADD COLUMN IF NOT EXISTS cpu_name TEXT,
ADD COLUMN IF NOT EXISTS cpu_count INTEGER,
ADD COLUMN IF NOT EXISTS cpu_cores INTEGER,
ADD COLUMN IF NOT EXISTS ram_total_gb NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS ram_available_gb NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS python_version TEXT;

-- Add comments for documentation
COMMENT ON COLUMN irc_devices.os_name IS 'Operating system name (e.g., Windows, Linux)';
COMMENT ON COLUMN irc_devices.os_version IS 'OS version/release';
COMMENT ON COLUMN irc_devices.os_arch IS 'System architecture (e.g., x86_64, AMD64)';
COMMENT ON COLUMN irc_devices.cpu_name IS 'CPU model name';
COMMENT ON COLUMN irc_devices.cpu_count IS 'Total CPU count (logical processors)';
COMMENT ON COLUMN irc_devices.cpu_cores IS 'Physical CPU cores';
COMMENT ON COLUMN irc_devices.ram_total_gb IS 'Total RAM in GB';
COMMENT ON COLUMN irc_devices.ram_available_gb IS 'Available RAM in GB';
COMMENT ON COLUMN irc_devices.python_version IS 'Python version running on the device';
