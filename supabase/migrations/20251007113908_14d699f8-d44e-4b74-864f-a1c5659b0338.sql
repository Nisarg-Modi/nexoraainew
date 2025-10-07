-- Fix security issue: Deny anonymous access to profiles table
-- Drop existing restrictive policy
DROP POLICY IF EXISTS "Users can only view their own profile" ON public.profiles;

-- Add explicit policy to deny anonymous access and allow proper profile viewing
CREATE POLICY "Authenticated users can view accessible profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  auth.role() = 'authenticated' 
  AND can_view_profile(auth.uid(), user_id)
);

-- Fix security issue: Deny anonymous access to contacts table
-- The existing policy already restricts to auth.uid() = user_id, but add explicit authentication check
DROP POLICY IF EXISTS "Users can view their own contacts" ON public.contacts;

CREATE POLICY "Authenticated users can view their own contacts"
ON public.contacts
FOR SELECT
TO authenticated
USING (
  auth.role() = 'authenticated' 
  AND auth.uid() = user_id
);

-- Fix security issue: Deny anonymous access to conversation_participants table
DROP POLICY IF EXISTS "Users can view conversation participants" ON public.conversation_participants;

CREATE POLICY "Authenticated users can view conversation participants"
ON public.conversation_participants
FOR SELECT
TO authenticated
USING (
  auth.role() = 'authenticated' 
  AND is_conversation_participant(conversation_id, auth.uid())
);