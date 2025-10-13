-- Add policy to allow users to leave conversations
CREATE POLICY "Users can leave conversations"
ON public.conversation_participants
FOR DELETE
USING (auth.uid() = user_id);