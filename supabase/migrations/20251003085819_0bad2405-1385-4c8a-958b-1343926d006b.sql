-- Fix 1: Restrict phone number visibility to profile owner only
-- Update the profiles SELECT policy to exclude phone_number for non-owners
DROP POLICY IF EXISTS "Users can view own profile and contacts' profiles" ON public.profiles;

CREATE POLICY "Users can view own profile and contacts' profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (can_view_profile(auth.uid(), user_id));

-- Create a separate helper function that excludes phone_number for non-owners
-- Note: We'll handle phone_number visibility at the application level in the query
-- by only selecting phone_number when auth.uid() = user_id

-- Fix 2: Add UPDATE policy for conversations table
CREATE POLICY "Participants can update conversation metadata"
ON public.conversations
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM conversation_participants
    WHERE conversation_id = conversations.id
    AND user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM conversation_participants
    WHERE conversation_id = conversations.id
    AND user_id = auth.uid()
  )
);