-- Migration: Add iracing_connected column to irc_devices table
-- Date: 2024-11-24
-- Description: Adds a boolean column to track iRacing connection status from PC service

-- Add the column if it doesn't exist
ALTER TABLE irc_devices 
ADD COLUMN IF NOT EXISTS iracing_connected BOOLEAN DEFAULT NULL;

-- Add a comment to document the column
COMMENT ON COLUMN irc_devices.iracing_connected IS 'Tracks whether iRacing SDK is connected (updated by PC service heartbeat)';

-- Verify the column was added (this will show an error if column already exists, which is fine)
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'irc_devices' AND column_name = 'iracing_connected';

