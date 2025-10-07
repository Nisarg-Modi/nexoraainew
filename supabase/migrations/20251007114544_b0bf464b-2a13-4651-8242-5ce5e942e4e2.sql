-- Create a security definer function to safely return profile data WITHOUT phone numbers
-- This function explicitly excludes phone_number from results for non-owners
CREATE OR REPLACE FUNCTION public.get_viewable_profile(viewer_id UUID, profile_user_id UUID)
RETURNS TABLE(
  user_id UUID,
  display_name TEXT,
  username TEXT,
  avatar_url TEXT,
  bio TEXT,
  status TEXT,
  -- phone_number is intentionally excluded for security
  auto_translate BOOLEAN,
  preferred_language TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.user_id,
    p.display_name,
    p.username,
    p.avatar_url,
    p.bio,
    p.status,
    -- phone_number is NOT returned for security
    p.auto_translate,
    p.preferred_language,
    p.created_at,
    p.updated_at
  FROM public.profiles p
  WHERE p.user_id = profile_user_id
    AND can_view_profile(viewer_id, profile_user_id);
$$;

-- Create a separate function to get phone number (owner only)
CREATE OR REPLACE FUNCTION public.get_own_phone_number(user_uuid UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT phone_number
  FROM public.profiles
  WHERE user_id = user_uuid
    AND user_id = auth.uid(); -- CRITICAL: Only return own phone number
$$;

-- Add comment explaining the security model
COMMENT ON FUNCTION public.get_viewable_profile IS 
'Safely returns profile data excluding phone_number. Phone numbers are considered sensitive PII and should only be accessed via get_own_phone_number() for the authenticated user.';

COMMENT ON FUNCTION public.get_own_phone_number IS
'Returns phone number for the authenticated user only. This function enforces that users can only access their own phone number, preventing enumeration attacks.';