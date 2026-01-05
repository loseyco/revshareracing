-- Add geolocation columns to irc_devices table for mapping rigs
-- These columns are populated automatically based on public IP address and reverse geocoding

ALTER TABLE irc_devices
ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS region TEXT,
ADD COLUMN IF NOT EXISTS country TEXT,
ADD COLUMN IF NOT EXISTS postal_code TEXT,
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS display_address TEXT;

-- Add comments for documentation
COMMENT ON COLUMN irc_devices.latitude IS 'Latitude coordinate from IP geolocation';
COMMENT ON COLUMN irc_devices.longitude IS 'Longitude coordinate from IP geolocation';
COMMENT ON COLUMN irc_devices.city IS 'City name from IP geolocation';
COMMENT ON COLUMN irc_devices.region IS 'State/Region name from IP geolocation';
COMMENT ON COLUMN irc_devices.country IS 'Country name from IP geolocation';
COMMENT ON COLUMN irc_devices.postal_code IS 'Postal/ZIP code from IP geolocation';
COMMENT ON COLUMN irc_devices.address IS 'Street address from reverse geocoding (e.g., "123 Main St, City, State")';
COMMENT ON COLUMN irc_devices.display_address IS 'Full formatted address from reverse geocoding service';

