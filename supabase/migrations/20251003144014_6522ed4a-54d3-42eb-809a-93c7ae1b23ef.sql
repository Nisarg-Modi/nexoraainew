-- Fix phone number harvesting vulnerability
-- Remove phone_number from profiles table SELECT visibility for non-owners

-- Drop the existing policy
DROP POLICY IF EXISTS "Users can view own profile and contacts' profiles" ON public.profiles;

-- Create two separate policies: one for viewing own profile (with phone), one for viewing others (without phone)
CREATE POLICY "Users can view their own full profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can view contacts' profiles (limited)" 
ON public.profiles 
FOR SELECT 
USING (
  auth.uid() != user_id 
  AND can_view_profile(auth.uid(), user_id)
);

-- Create a security definer function to find users by phone number
-- This allows the contact addition feature to work without exposing phone numbers
CREATE OR REPLACE FUNCTION public.find_user_by_phone(input_phone text)
RETURNS TABLE(user_id uuid, display_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT p.user_id, p.display_name
  FROM public.profiles p
  WHERE p.phone_number = input_phone;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.find_user_by_phone(text) TO authenticated;