-- ============================================================================
-- CRITICAL SECURITY FIXES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. SECURE LOGIN ATTEMPTS TABLE (CRITICAL)
-- ----------------------------------------------------------------------------
-- Issue: Plaintext usernames stored, enabling user enumeration attacks
-- Fix: Hash identifiers and reduce retention period

-- Add function to hash identifiers
CREATE OR REPLACE FUNCTION public.hash_identifier(identifier_text text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Use SHA-256 to hash the identifier
  RETURN encode(digest(identifier_text, 'sha256'), 'hex');
END;
$$;

-- Update login attempt recording to use hashed identifiers
CREATE OR REPLACE FUNCTION public.record_login_attempt(identifier_text text, was_successful boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Store hashed identifier instead of plaintext
  INSERT INTO login_attempts (identifier, success)
  VALUES (hash_identifier(identifier_text), was_successful);
  
  -- Clean up old attempts (reduced from 24 hours to 15 minutes)
  DELETE FROM login_attempts
  WHERE attempt_time < NOW() - INTERVAL '15 minutes';
END;
$$;

-- Update rate limit check to use hashed identifiers
CREATE OR REPLACE FUNCTION public.check_login_rate_limit(identifier_text text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  recent_attempts INTEGER;
  hashed_id TEXT;
BEGIN
  hashed_id := hash_identifier(identifier_text);
  
  -- Count failed attempts in last 15 minutes
  SELECT COUNT(*) INTO recent_attempts
  FROM login_attempts
  WHERE identifier = hashed_id
    AND success = false
    AND attempt_time > NOW() - INTERVAL '15 minutes';
  
  -- Allow if less than 5 failed attempts in last 15 minutes
  RETURN recent_attempts < 5;
END;
$$;

-- Clear existing login attempts data (contains plaintext identifiers)
TRUNCATE TABLE login_attempts;

-- Add comment documenting the security model
COMMENT ON TABLE login_attempts IS 'Stores hashed login attempt identifiers for rate limiting. Retention: 15 minutes. Never stores plaintext usernames.';

-- ----------------------------------------------------------------------------
-- 2. RESTRICT PHONE NUMBER ACCESS (HIGH PRIORITY)
-- ----------------------------------------------------------------------------
-- Issue: Phone numbers visible to all contacts via can_view_profile()
-- Fix: Add database-level protection and application guidance

-- Create function to get safe profile data (excludes phone_number)
CREATE OR REPLACE FUNCTION public.get_safe_profile(profile_user_id uuid)
RETURNS TABLE (
  user_id uuid,
  display_name text,
  username text,
  avatar_url text,
  bio text,
  status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    user_id,
    display_name,
    username,
    avatar_url,
    bio,
    status
  FROM public.profiles
  WHERE user_id = profile_user_id
    AND can_view_profile(auth.uid(), profile_user_id);
$$;

-- Add comment documenting phone number privacy policy
COMMENT ON COLUMN profiles.phone_number IS 'SENSITIVE: Phone number should only be accessed when auth.uid() = user_id. Use get_safe_profile() function for other users.';

-- Update can_view_profile function with security documentation
COMMENT ON FUNCTION can_view_profile IS 'Determines if viewer can see profile row. Note: Does not restrict column access - phone_number should only be queried when viewer_id = profile_user_id.';

-- ----------------------------------------------------------------------------
-- 3. PREVENT MESSAGE TAMPERING (MEDIUM PRIORITY)
-- ----------------------------------------------------------------------------
-- Issue: No explicit UPDATE/DELETE policies on messages table
-- Fix: Add restrictive policies to ensure message immutability

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Messages are immutable - no updates" ON messages;
DROP POLICY IF EXISTS "Messages cannot be deleted" ON messages;

-- Prevent all message updates (messages are immutable)
CREATE POLICY "Messages are immutable - no updates"
ON messages
FOR UPDATE
TO authenticated
USING (false);

-- Prevent message deletion (audit trail integrity)
CREATE POLICY "Messages cannot be deleted"
ON messages
FOR DELETE
TO authenticated
USING (false);

-- Add comment documenting immutability policy
COMMENT ON TABLE messages IS 'Messages are immutable once created. No updates or deletions permitted to maintain conversation integrity and audit trail.';

-- ----------------------------------------------------------------------------
-- 4. ADD SECURITY AUDIT LOGGING
-- ----------------------------------------------------------------------------
-- Create table for security audit events

CREATE TABLE IF NOT EXISTS public.security_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  user_id uuid REFERENCES auth.users(id),
  metadata jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on audit log
ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;

-- Only system can write to audit log
CREATE POLICY "No direct access to audit log"
ON public.security_audit_log
FOR ALL
TO authenticated
USING (false);

-- Add index for performance
CREATE INDEX idx_security_audit_log_user_id ON public.security_audit_log(user_id);
CREATE INDEX idx_security_audit_log_created_at ON public.security_audit_log(created_at);

-- Add comment
COMMENT ON TABLE security_audit_log IS 'Security audit trail. System-managed, no direct user access.';
