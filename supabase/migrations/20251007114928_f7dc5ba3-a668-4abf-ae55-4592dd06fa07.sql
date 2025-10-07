-- Clean up previous attempts
DROP VIEW IF EXISTS public.profiles_safe CASCADE;
DROP TABLE IF EXISTS public._security_documentation CASCADE;

-- Drop the audit trigger that depends on phone_number column
DROP TRIGGER IF EXISTS audit_phone_update_trigger ON public.profiles CASCADE;
DROP FUNCTION IF EXISTS public.audit_phone_update CASCADE;

-- Create a separate secure table for phone numbers (owner-only access)
CREATE TABLE IF NOT EXISTS public.profiles_private (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_number TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on private profiles
ALTER TABLE public.profiles_private ENABLE ROW LEVEL SECURITY;

-- Only allow users to view and modify their own phone number
CREATE POLICY "Users can only view their own phone number"
ON public.profiles_private
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can only insert their own phone number"
ON public.profiles_private
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only update their own phone number"
ON public.profiles_private
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can only delete their own phone number"
ON public.profiles_private
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Migrate existing phone numbers to the new table
INSERT INTO public.profiles_private (user_id, phone_number, created_at, updated_at)
SELECT user_id, phone_number, created_at, updated_at
FROM public.profiles
WHERE phone_number IS NOT NULL
ON CONFLICT (user_id) DO UPDATE SET
  phone_number = EXCLUDED.phone_number,
  updated_at = EXCLUDED.updated_at;

-- Now safe to drop the phone_number column
ALTER TABLE public.profiles DROP COLUMN phone_number;

-- Recreate the audit trigger for profiles_private instead
CREATE OR REPLACE FUNCTION public.audit_phone_update_private()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Log when phone number is updated
  IF OLD.phone_number IS DISTINCT FROM NEW.phone_number THEN
    INSERT INTO public.security_audit_log (user_id, event_type, metadata)
    VALUES (
      auth.uid(),
      'phone_number_updated',
      jsonb_build_object(
        'profile_user_id', NEW.user_id,
        'timestamp', NOW()
      )
    );
  END IF;
  
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER audit_phone_update_trigger
BEFORE UPDATE ON public.profiles_private
FOR EACH ROW
EXECUTE FUNCTION public.audit_phone_update_private();

-- Add helpful comments
COMMENT ON TABLE public.profiles_private IS 
'Secure storage for sensitive profile data like phone numbers. Access is restricted to profile owners only via RLS policies.';

COMMENT ON COLUMN public.profiles_private.phone_number IS
'User phone number. Only accessible to the profile owner due to owner-only RLS policies.';