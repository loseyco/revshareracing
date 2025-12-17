-- Add credits column to irc_user_profiles table
-- Credits system: 1 credit = $0.01
-- 1-minute timed test session costs 100 credits

ALTER TABLE irc_user_profiles 
ADD COLUMN IF NOT EXISTS credits INTEGER NOT NULL DEFAULT 0;

-- Add constraint to ensure credits cannot be negative
ALTER TABLE irc_user_profiles 
ADD CONSTRAINT irc_user_profiles_credits_check 
CHECK (credits >= 0);

-- Add comment for documentation
COMMENT ON COLUMN irc_user_profiles.credits IS 'User credit balance. 1 credit = $0.01. 1-minute test session costs 100 credits.';

-- Update existing profiles to have 0 credits if they don't have the column yet
-- (This is safe because we're using DEFAULT 0, but included for clarity)
UPDATE irc_user_profiles 
SET credits = 0 
WHERE credits IS NULL;

-- Create optional RPC function for atomic credit deduction
-- This ensures credits are deducted atomically and prevents race conditions
CREATE OR REPLACE FUNCTION deduct_credits(
  user_id_param UUID,
  amount_param INTEGER
)
RETURNS INTEGER AS $$
DECLARE
  current_credits INTEGER;
  new_credits INTEGER;
BEGIN
  -- Get current credits
  SELECT credits INTO current_credits
  FROM irc_user_profiles
  WHERE id = user_id_param;
  
  -- If user doesn't exist, return error
  IF current_credits IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  
  -- Calculate new credits (ensure non-negative)
  new_credits := GREATEST(0, current_credits - amount_param);
  
  -- Update credits
  UPDATE irc_user_profiles
  SET credits = new_credits
  WHERE id = user_id_param;
  
  -- Return new balance
  RETURN new_credits;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment for documentation
COMMENT ON FUNCTION deduct_credits IS 'Atomically deduct credits from a user account. Returns the new credit balance.';

