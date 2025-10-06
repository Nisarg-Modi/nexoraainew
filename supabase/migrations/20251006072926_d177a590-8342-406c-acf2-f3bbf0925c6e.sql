-- Security Fix: Protect phone numbers from unauthorized access
-- Drop and recreate the SELECT policy with explicit restrictions
DROP POLICY IF EXISTS "Users can view their own full profile" ON public.profiles;
DROP POLICY IF EXISTS "Deny access to other users' profiles" ON public.profiles;

-- Create a single, explicit SELECT policy that only allows viewing own profile
CREATE POLICY "Users can only view their own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Update get_safe_profile function to explicitly exclude sensitive data
-- This function is used by other parts of the app to safely access profile info
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
  -- Explicitly select only non-sensitive columns
  -- IMPORTANT: phone_number is intentionally excluded for security
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

-- Ensure find_user_by_phone function doesn't leak sensitive data
CREATE OR REPLACE FUNCTION public.find_user_by_phone(input_phone text)
RETURNS TABLE(user_id uuid, display_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only return user_id and display_name, never the phone number itself
  RETURN QUERY
  SELECT p.user_id, p.display_name
  FROM public.profiles p
  WHERE p.phone_number = input_phone;
END;
$$;

-- Add a function to check phone number existence without exposing it
CREATE OR REPLACE FUNCTION public.phone_number_exists(input_phone text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE phone_number = input_phone
  );
$$;

-- Add audit trigger for phone number updates only
CREATE OR REPLACE FUNCTION public.audit_phone_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
  
  RETURN NEW;
END;
$$;

-- Create trigger for phone number updates
DROP TRIGGER IF EXISTS audit_phone_update_trigger ON public.profiles;
CREATE TRIGGER audit_phone_update_trigger
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  WHEN (OLD.phone_number IS DISTINCT FROM NEW.phone_number)
  EXECUTE FUNCTION public.audit_phone_update();

-- Add documentation comment
COMMENT ON COLUMN public.profiles.phone_number IS 
  'SENSITIVE DATA: Phone numbers must only be accessible to the profile owner via RLS. Never expose through SECURITY DEFINER functions or public APIs.';