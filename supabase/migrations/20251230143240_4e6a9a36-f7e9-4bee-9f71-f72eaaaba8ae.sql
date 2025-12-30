-- Create table for persistent rate limiting
CREATE TABLE public.ai_chat_rate_limits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  request_count integer NOT NULL DEFAULT 1,
  window_start timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_rate_limit UNIQUE (user_id)
);

-- Enable RLS
ALTER TABLE public.ai_chat_rate_limits ENABLE ROW LEVEL SECURITY;

-- Only allow service role access (edge functions use service role)
CREATE POLICY "Service role only access"
ON public.ai_chat_rate_limits
FOR ALL
USING (false)
WITH CHECK (false);

-- Create index for faster lookups
CREATE INDEX idx_ai_chat_rate_limits_user_id ON public.ai_chat_rate_limits(user_id);
CREATE INDEX idx_ai_chat_rate_limits_window_start ON public.ai_chat_rate_limits(window_start);

-- Function to check and update rate limit atomically
CREATE OR REPLACE FUNCTION public.check_ai_chat_rate_limit(
  p_user_id uuid,
  p_max_requests integer DEFAULT 20,
  p_window_seconds integer DEFAULT 60
)
RETURNS TABLE(allowed boolean, remaining integer, reset_in integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamp with time zone := now();
  v_window_start timestamp with time zone;
  v_request_count integer;
  v_seconds_elapsed integer;
BEGIN
  -- Try to get existing rate limit record
  SELECT rl.window_start, rl.request_count
  INTO v_window_start, v_request_count
  FROM ai_chat_rate_limits rl
  WHERE rl.user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    -- First request - create new record
    INSERT INTO ai_chat_rate_limits (user_id, request_count, window_start)
    VALUES (p_user_id, 1, v_now);
    
    RETURN QUERY SELECT true, p_max_requests - 1, p_window_seconds;
    RETURN;
  END IF;

  -- Calculate seconds elapsed since window start
  v_seconds_elapsed := EXTRACT(EPOCH FROM (v_now - v_window_start))::integer;

  IF v_seconds_elapsed >= p_window_seconds THEN
    -- Window expired - reset
    UPDATE ai_chat_rate_limits
    SET request_count = 1, window_start = v_now, updated_at = v_now
    WHERE user_id = p_user_id;
    
    RETURN QUERY SELECT true, p_max_requests - 1, p_window_seconds;
    RETURN;
  END IF;

  IF v_request_count >= p_max_requests THEN
    -- Rate limit exceeded
    RETURN QUERY SELECT false, 0, p_window_seconds - v_seconds_elapsed;
    RETURN;
  END IF;

  -- Increment count
  UPDATE ai_chat_rate_limits
  SET request_count = request_count + 1, updated_at = v_now
  WHERE user_id = p_user_id;

  RETURN QUERY SELECT true, p_max_requests - v_request_count - 1, p_window_seconds - v_seconds_elapsed;
END;
$$;

-- Cleanup function to remove old rate limit records (run periodically)
CREATE OR REPLACE FUNCTION public.cleanup_ai_chat_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM ai_chat_rate_limits
  WHERE window_start < now() - interval '1 hour';
END;
$$;