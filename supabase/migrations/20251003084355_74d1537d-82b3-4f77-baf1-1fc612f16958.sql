-- Create login attempts tracking table
CREATE TABLE public.login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL, -- Can be username, email, or IP
  attempt_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  success BOOLEAN NOT NULL DEFAULT false
);

-- Create index for efficient queries
CREATE INDEX idx_login_attempts_identifier_time ON public.login_attempts(identifier, attempt_time DESC);

-- Enable RLS
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

-- Only system can write to this table (via security definer functions)
CREATE POLICY "No direct access to login attempts"
ON public.login_attempts
FOR ALL
USING (false);

-- Function to check login rate limit
CREATE OR REPLACE FUNCTION public.check_login_rate_limit(identifier_text TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_attempts INTEGER;
BEGIN
  -- Count failed attempts in last 15 minutes
  SELECT COUNT(*) INTO recent_attempts
  FROM login_attempts
  WHERE identifier = identifier_text
    AND success = false
    AND attempt_time > NOW() - INTERVAL '15 minutes';
  
  -- Allow if less than 5 failed attempts in last 15 minutes
  RETURN recent_attempts < 5;
END;
$$;

-- Function to record login attempt
CREATE OR REPLACE FUNCTION public.record_login_attempt(identifier_text TEXT, was_successful BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO login_attempts (identifier, success)
  VALUES (identifier_text, was_successful);
  
  -- Clean up old attempts (older than 1 day)
  DELETE FROM login_attempts
  WHERE attempt_time < NOW() - INTERVAL '1 day';
END;
$$;

-- Update get_email_by_username to be rate-limited
CREATE OR REPLACE FUNCTION public.get_email_by_username_rate_limited(input_username TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email TEXT;
BEGIN
  -- Check rate limit first
  IF NOT check_login_rate_limit(input_username) THEN
    RAISE EXCEPTION 'Too many login attempts. Please try again later.';
  END IF;
  
  SELECT u.email INTO user_email
  FROM auth.users u
  INNER JOIN public.profiles p ON p.user_id = u.id
  WHERE LOWER(p.username) = LOWER(input_username);
  
  RETURN user_email;
END;
$$;