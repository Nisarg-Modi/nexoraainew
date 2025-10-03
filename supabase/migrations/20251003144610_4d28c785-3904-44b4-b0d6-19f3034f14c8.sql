-- Fix phone number exposure vulnerability - ACTUALLY remove the unsafe policy
-- The policy "Users can view contacts' profiles (limited)" exposes ALL columns including phone_number

-- Drop the unsafe policy that allows contacts to view full profiles
DROP POLICY IF EXISTS "Users can view contacts' profiles (limited)" ON public.profiles;

-- Now the profiles table only has one SELECT policy:
-- "Users can view their own full profile" - allows seeing own phone_number

-- Applications must now:
-- 1. Use get_safe_profile() function to view contact profiles (excludes phone_number)
-- 2. Or use SELECT with explicit safe columns: display_name, status, avatar_url, bio, username
-- 3. Direct SELECT queries by non-owners will fail due to RLS

-- The existing get_safe_profile() function provides secure access to contact profiles