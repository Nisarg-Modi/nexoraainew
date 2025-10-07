-- Create a secure view that masks phone_number for non-owners
-- This provides an additional security layer for client applications
CREATE OR REPLACE VIEW public.profiles_safe AS
SELECT 
  p.user_id,
  p.display_name,
  p.username,
  p.avatar_url,
  p.bio,
  p.status,
  p.auto_translate,
  p.preferred_language,
  p.created_at,
  p.updated_at,
  -- Only show phone_number to the profile owner
  CASE 
    WHEN p.user_id = auth.uid() THEN p.phone_number
    ELSE NULL
  END AS phone_number
FROM public.profiles p;

-- Enable RLS on the view
ALTER VIEW public.profiles_safe SET (security_invoker = true);

-- Add helpful comments
COMMENT ON VIEW public.profiles_safe IS 
'Secure view of profiles that masks phone_number for non-owners. 
RECOMMENDED: Use this view instead of direct profiles table queries to prevent phone number enumeration.
Phone numbers are only visible when querying your own profile.';

-- Create a documentation table explaining the security model
CREATE TABLE IF NOT EXISTS public._security_documentation (
  feature TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  best_practice TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public._security_documentation (feature, description, best_practice)
VALUES (
  'profile_phone_numbers',
  'Phone numbers in the profiles table are sensitive PII that should be protected from enumeration attacks.',
  'Always use profiles_safe view or get_viewable_profile() function instead of direct SELECT on profiles table. Only query phone_number when viewing your own profile.'
)
ON CONFLICT (feature) DO UPDATE SET
  description = EXCLUDED.description,
  best_practice = EXCLUDED.best_practice;