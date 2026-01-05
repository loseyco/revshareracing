-- Add pc_service_version column to irc_devices table
-- This column stores the version of the PC service running on the device

ALTER TABLE irc_devices
ADD COLUMN IF NOT EXISTS pc_service_version TEXT;

-- Add comment for documentation
COMMENT ON COLUMN irc_devices.pc_service_version IS 'Version of the PC service running on this device (e.g., 1.0.1)';


