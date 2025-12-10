-- Fix irc_user_profiles role constraint to allow all valid roles
-- Run this in your Supabase SQL Editor

-- First, drop the existing constraint if it exists
ALTER TABLE irc_user_profiles 
DROP CONSTRAINT IF EXISTS irc_user_profiles_role_check;

-- Add a new constraint that allows all valid roles
ALTER TABLE irc_user_profiles 
ADD CONSTRAINT irc_user_profiles_role_check 
CHECK (role IN ('user', 'admin', 'super_admin', 'driver'));

-- Verify the constraint was created
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'irc_user_profiles'::regclass
AND conname = 'irc_user_profiles_role_check';

