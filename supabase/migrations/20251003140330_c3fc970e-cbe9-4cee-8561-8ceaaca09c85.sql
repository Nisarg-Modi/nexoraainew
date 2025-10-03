-- Allow users to find profiles by phone number for adding contacts
DROP POLICY IF EXISTS "Users can view own profile and contacts' profiles" ON public.profiles;

CREATE POLICY "Users can view own profile and contacts' profiles" 
ON public.profiles 
FOR SELECT 
USING (
  can_view_profile(auth.uid(), user_id) OR 
  -- Allow searching by phone number for adding contacts
  phone_number IS NOT NULL
);