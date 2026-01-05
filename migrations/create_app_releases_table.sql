-- Create app_releases table for storing download links
-- This allows the website to fetch the current download URL dynamically

CREATE TABLE IF NOT EXISTS app_releases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version TEXT NOT NULL UNIQUE,
    download_url TEXT NOT NULL,
    filename TEXT NOT NULL,
    release_notes TEXT,
    published_at TIMESTAMPTZ,
    is_latest BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_app_releases_version ON app_releases(version);
CREATE INDEX IF NOT EXISTS idx_app_releases_is_latest ON app_releases(is_latest) WHERE is_latest = true;

-- Function to automatically set is_latest = false for other releases when a new one is marked as latest
CREATE OR REPLACE FUNCTION update_latest_release()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_latest = true THEN
        UPDATE app_releases SET is_latest = false WHERE version != NEW.version;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update other releases when a new latest is set
DROP TRIGGER IF EXISTS set_latest_release ON app_releases;
CREATE TRIGGER set_latest_release
    BEFORE INSERT OR UPDATE ON app_releases
    FOR EACH ROW
    EXECUTE FUNCTION update_latest_release();

-- Make the table publicly readable (for the website to fetch download links)
ALTER TABLE app_releases ENABLE ROW LEVEL SECURITY;

-- Policy: Allow public read access to releases
CREATE POLICY "Public can read app releases"
    ON app_releases
    FOR SELECT
    USING (true);

-- Insert initial release if needed (optional)
-- INSERT INTO app_releases (version, download_url, filename, release_notes, is_latest)
-- VALUES ('1.0.0', 'https://your-project.supabase.co/storage/v1/object/public/releases/iRCommander.exe', 'iRCommander.exe', 'Initial release', true)
-- ON CONFLICT (version) DO NOTHING;
