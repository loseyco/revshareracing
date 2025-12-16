-- Add column to track when user became position 1
ALTER TABLE irc_device_queue 
ADD COLUMN IF NOT EXISTS became_position_one_at TIMESTAMPTZ;

-- Create function to update became_position_one_at when position becomes 1
CREATE OR REPLACE FUNCTION update_became_position_one_at()
RETURNS TRIGGER AS $$
BEGIN
    -- If this is an INSERT and position is 1, set the timestamp
    IF TG_OP = 'INSERT' AND NEW.position = 1 AND NEW.status = 'waiting' THEN
        NEW.became_position_one_at = NOW();
    END IF;
    
    -- If this is an UPDATE
    IF TG_OP = 'UPDATE' THEN
        -- If position changes from something else to 1, set the timestamp
        IF OLD.position != 1 AND NEW.position = 1 AND NEW.status = 'waiting' THEN
            NEW.became_position_one_at = NOW();
        END IF;
        
        -- If position changes from 1 to something else, clear the timestamp
        IF OLD.position = 1 AND NEW.position != 1 THEN
            NEW.became_position_one_at = NULL;
        END IF;
        
        -- If already position 1 but timestamp is NULL (shouldn't happen, but safety check)
        IF NEW.position = 1 AND NEW.status = 'waiting' AND NEW.became_position_one_at IS NULL THEN
            NEW.became_position_one_at = NOW();
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to update became_position_one_at
DROP TRIGGER IF EXISTS update_became_position_one_at_trigger ON irc_device_queue;
CREATE TRIGGER update_became_position_one_at_trigger
    BEFORE INSERT OR UPDATE ON irc_device_queue
    FOR EACH ROW
    EXECUTE FUNCTION update_became_position_one_at();

-- Update existing position 1 entries to set became_position_one_at to joined_at
-- (for entries that are already position 1)
UPDATE irc_device_queue
SET became_position_one_at = joined_at
WHERE position = 1 
  AND status = 'waiting' 
  AND became_position_one_at IS NULL;

-- Add comment
COMMENT ON COLUMN irc_device_queue.became_position_one_at IS 'When user became position 1 in the queue (used for 60-second timeout)';

