-- Fix conversation_participants INSERT policy to require authentication
DROP POLICY IF EXISTS "Users can add participants to conversations" ON public.conversation_participants;

CREATE POLICY "Authenticated users can add participants to conversations"
ON public.conversation_participants
FOR INSERT
TO authenticated
WITH CHECK (
  auth.role() = 'authenticated'
  AND ((user_id = auth.uid()) OR is_conversation_participant(conversation_id, auth.uid()))
);