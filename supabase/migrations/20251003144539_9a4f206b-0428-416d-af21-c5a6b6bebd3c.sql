-- Fix phone number exposure vulnerability
-- Strategy: Lock down profiles table to owners only, require use of get_safe_profile() function

-- The profiles table now only has one SELECT policy:
-- "Users can view their own full profile" - this allows users to see their own phone_number
-- We removed "Users can view contacts' profiles (limited)" which was exposing all columns

-- No changes needed to RLS policies - the previous migration already removed the unsafe policy
-- The current state is:
-- 1. Users can SELECT their own profile (with phone_number) via existing policy
-- 2. Users can UPDATE/INSERT their own profile via existing policies  
-- 3. No policy exists for viewing other users' profiles directly

-- The get_safe_profile function already exists and excludes phone_number
-- Applications should use get_safe_profile() or query specific safe columns

-- Add a helpful comment to document the security design
COMMENT ON TABLE public.profiles IS 
'User profiles table. Direct SELECT is restricted to profile owners only. 
To view other users'' profiles, use the get_safe_profile() function which excludes sensitive fields like phone_number.';

-- Also prevent accidental exposure via functions - ensure get_safe_profile is the recommended way
COMMENT ON FUNCTION public.get_safe_profile(uuid) IS
'Securely retrieves profile information for contacts, excluding sensitive fields like phone_number. 
Use this function instead of direct SELECT queries when displaying profile information for users other than the authenticated user.';