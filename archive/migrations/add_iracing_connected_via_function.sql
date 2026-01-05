-- Migration: Add iracing_connected column via database function
-- This creates a function that can be called via Supabase RPC
-- Run this in Supabase SQL Editor first, then call the function

-- Step 1: Create a function to add the column
CREATE OR REPLACE FUNCTION add_iracing_connected_column()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Add the column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'irc_devices' 
        AND column_name = 'iracing_connected'
    ) THEN
        ALTER TABLE irc_devices 
        ADD COLUMN iracing_connected BOOLEAN DEFAULT NULL;
        
        COMMENT ON COLUMN irc_devices.iracing_connected IS 
            'Tracks whether iRacing SDK is connected (updated by PC service heartbeat)';
        
        RAISE NOTICE 'Column iracing_connected added successfully';
    ELSE
        RAISE NOTICE 'Column iracing_connected already exists';
    END IF;
END;
$$;

-- Step 2: Call the function to add the column
SELECT add_iracing_connected_column();

-- Step 3: (Optional) Drop the function after use
-- DROP FUNCTION IF EXISTS add_iracing_connected_column();

