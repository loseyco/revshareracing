-- Drop existing table if it exists (to ensure clean state)
-- This is safe because queue data can be regenerated
DROP TABLE IF EXISTS irc_device_queue CASCADE;

-- Create irc_device_queue table for user queue management
-- This table tracks users waiting to drive on a specific rig
CREATE TABLE irc_device_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id TEXT NOT NULL REFERENCES irc_devices(device_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'completed', 'cancelled')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for efficient queue queries
CREATE INDEX IF NOT EXISTS idx_device_queue_device_status ON irc_device_queue(device_id, status);
CREATE INDEX IF NOT EXISTS idx_device_queue_user ON irc_device_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_device_queue_position ON irc_device_queue(device_id, position) WHERE status = 'waiting';

-- Note: No cleanup needed since we dropped and recreated the table

-- Create partial unique index to ensure one active queue entry per user per device
-- This prevents users from being in the queue multiple times with 'waiting' or 'active' status
CREATE UNIQUE INDEX IF NOT EXISTS idx_device_queue_unique_active 
    ON irc_device_queue(device_id, user_id) 
    WHERE status IN ('waiting', 'active');

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to update updated_at
DROP TRIGGER IF EXISTS update_irc_device_queue_updated_at ON irc_device_queue;
CREATE TRIGGER update_irc_device_queue_updated_at
    BEFORE UPDATE ON irc_device_queue
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create function to automatically assign position when joining queue
CREATE OR REPLACE FUNCTION assign_queue_position()
RETURNS TRIGGER AS $$
BEGIN
    -- Only assign position for new 'waiting' entries
    IF NEW.status = 'waiting' AND NEW.position IS NULL THEN
        SELECT COALESCE(MAX(position), 0) + 1
        INTO NEW.position
        FROM irc_device_queue
        WHERE device_id = NEW.device_id AND status = 'waiting';
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to assign position
DROP TRIGGER IF EXISTS assign_queue_position_trigger ON irc_device_queue;
CREATE TRIGGER assign_queue_position_trigger
    BEFORE INSERT ON irc_device_queue
    FOR EACH ROW
    EXECUTE FUNCTION assign_queue_position();

-- Create function to reorder positions when someone leaves
CREATE OR REPLACE FUNCTION reorder_queue_positions()
RETURNS TRIGGER AS $$
DECLARE
    old_position INTEGER;
BEGIN
    -- Only reorder if a waiting entry was removed
    IF OLD.status = 'waiting' AND (NEW.status IS NULL OR NEW.status != 'waiting') THEN
        old_position := OLD.position;
        
        -- Decrement positions of all entries after the removed one
        UPDATE irc_device_queue
        SET position = position - 1
        WHERE device_id = OLD.device_id
          AND status = 'waiting'
          AND position > old_position;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to reorder positions
DROP TRIGGER IF EXISTS reorder_queue_positions_trigger ON irc_device_queue;
CREATE TRIGGER reorder_queue_positions_trigger
    AFTER UPDATE OR DELETE ON irc_device_queue
    FOR EACH ROW
    EXECUTE FUNCTION reorder_queue_positions();

-- Add comments for documentation
COMMENT ON TABLE irc_device_queue IS 'Queue of users waiting to drive on a specific rig';
COMMENT ON COLUMN irc_device_queue.device_id IS 'The rig/device ID';
COMMENT ON COLUMN irc_device_queue.user_id IS 'The user waiting in queue';
COMMENT ON COLUMN irc_device_queue.position IS 'Position in queue (1 = next, 2 = second, etc.)';
COMMENT ON COLUMN irc_device_queue.status IS 'Queue entry status: waiting, active, completed, cancelled';
COMMENT ON COLUMN irc_device_queue.joined_at IS 'When user joined the queue';
COMMENT ON COLUMN irc_device_queue.started_at IS 'When user started driving (status changed to active)';
COMMENT ON COLUMN irc_device_queue.completed_at IS 'When user finished driving (status changed to completed)';

-- Enable Row Level Security
ALTER TABLE irc_device_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view queue for any device (public read)
CREATE POLICY "Queue is publicly readable"
    ON irc_device_queue FOR SELECT
    USING (true);

-- Users can only insert their own queue entries (authenticated write)
CREATE POLICY "Users can join queue"
    ON irc_device_queue FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can only update their own queue entries
CREATE POLICY "Users can update own queue entry"
    ON irc_device_queue FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Users can only delete their own queue entries
CREATE POLICY "Users can leave queue"
    ON irc_device_queue FOR DELETE
    USING (auth.uid() = user_id);

