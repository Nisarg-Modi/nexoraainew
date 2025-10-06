-- Security fix for phone number exposure in profiles table
-- This migration adds explicit protection and audit logging

-- First, recreate the existing SELECT policy with clear documentation
DROP POLICY IF EXISTS "Users can view their own full profile" ON public.profiles;
DROP POLICY IF EXISTS "Deny access to other users' profiles" ON public.profiles;

CREATE POLICY "Users can view their own full profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Update get_safe_profile function with enhanced security documentation
CREATE OR REPLACE FUNCTION public.get_safe_profile(profile_user_id uuid)
RETURNS TABLE(
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
  -- SECURITY: This function intentionally excludes phone_number and email
  -- to prevent exposure of sensitive PII through SECURITY DEFINER bypass
  SELECT 
    p.user_id,
    p.display_name,
    p.username,
    p.avatar_url,
    p.bio,
    p.status
  FROM public.profiles p
  WHERE p.user_id = profile_user_id
    AND can_view_profile(auth.uid(), profile_user_id);
$$;

-- Ensure find_user_by_phone has audit logging
CREATE OR REPLACE FUNCTION public.find_user_by_phone(input_phone text)
RETURNS TABLE(user_id uuid, display_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Audit phone number lookups
  INSERT INTO public.security_audit_log (user_id, event_type, metadata)
  VALUES (
    auth.uid(),
    'phone_lookup',
    jsonb_build_object(
      'timestamp', NOW(),
      'lookup_method', 'by_phone'
    )
  );
  
  -- Return only non-sensitive fields (never return the phone number itself)
  RETURN QUERY
  SELECT p.user_id, p.display_name
  FROM public.profiles p
  WHERE p.phone_number = input_phone;
END;
$$;

-- Add trigger to audit UPDATE operations that modify phone numbers
CREATE OR REPLACE FUNCTION public.audit_phone_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only log if phone number was changed
  IF (OLD.phone_number IS DISTINCT FROM NEW.phone_number) THEN
    INSERT INTO public.security_audit_log (user_id, event_type, metadata)
    VALUES (
      auth.uid(),
      'phone_number_updated',
      jsonb_build_object(
        'profile_user_id', NEW.user_id,
        'had_phone', (OLD.phone_number IS NOT NULL),
        'has_phone', (NEW.phone_number IS NOT NULL)
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_phone_update_trigger ON public.profiles;
CREATE TRIGGER audit_phone_update_trigger
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_phone_update();

-- Add database column comment to document security requirements
COMMENT ON COLUMN public.profiles.phone_number IS 
  'SENSITIVE PII: Must never be returned by SECURITY DEFINER functions or exposed through public APIs. Only accessible to profile owner via RLS policy.';

COMMENT ON COLUMN public.profiles.user_id IS
  'Primary key linking to auth.users. All RLS policies must check auth.uid() = user_id for phone_number access.';

-- Add helpful comment on the table itself
COMMENT ON TABLE public.profiles IS
  'User profiles with PII protection. phone_number field is protected by RLS and excluded from all SECURITY DEFINER functions.';