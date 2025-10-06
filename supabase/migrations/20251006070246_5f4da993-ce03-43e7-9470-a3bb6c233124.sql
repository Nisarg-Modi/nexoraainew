-- Drop the existing unique constraint on username
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_username_key;

-- Create a case-insensitive unique index on username
CREATE UNIQUE INDEX profiles_username_lower_key ON public.profiles (LOWER(username));

-- Update the signup validation to use case-insensitive check
-- Note: The application code will need to check for existing usernames case-insensitively

-- Add a function to check username availability (case-insensitive)
CREATE OR REPLACE FUNCTION public.is_username_available(check_username text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE LOWER(username) = LOWER(check_username)
  );
$$;