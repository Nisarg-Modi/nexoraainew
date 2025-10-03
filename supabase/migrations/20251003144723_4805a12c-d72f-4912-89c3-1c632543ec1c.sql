-- Add DELETE policy to prevent unauthorized profile deletion
-- Profiles should only be deletable by their owners (or potentially admins in the future)

CREATE POLICY "Users can delete their own profile"
ON public.profiles
FOR DELETE
USING (auth.uid() = user_id);

-- Verify current SELECT policies for profiles table
-- Should only have: "Users can view their own full profile"
-- This ensures contacts cannot access phone_number field