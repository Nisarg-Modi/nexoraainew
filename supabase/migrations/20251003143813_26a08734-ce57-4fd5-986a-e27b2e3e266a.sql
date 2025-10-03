-- Fix: Remove public phone number exposure from profiles table
-- Drop the existing policy that allows viewing all profiles with phone numbers
DROP POLICY IF EXISTS "Users can view own profile and contacts' profiles" ON public.profiles;

-- Recreate the policy without the phone_number condition
-- Users can now only view their own profile and profiles of actual contacts
CREATE POLICY "Users can view own profile and contacts' profiles" 
ON public.profiles 
FOR SELECT 
USING (can_view_profile(auth.uid(), user_id));