-- Add DELETE policy for conversations table
-- Allows conversation creators or the last remaining participant to delete conversations

-- Policy: Creators can delete their own conversations
CREATE POLICY "Creators can delete their own conversations"
ON public.conversations
FOR DELETE
USING (auth.uid() = created_by);

-- Policy: Last participant can delete a conversation when leaving
-- This handles cases where all other participants have left
CREATE POLICY "Last participant can delete empty conversation"
ON public.conversations
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM conversation_participants cp
    WHERE cp.conversation_id = conversations.id
    AND cp.user_id = auth.uid()
  )
  AND (
    SELECT COUNT(*) FROM conversation_participants
    WHERE conversation_id = conversations.id
  ) = 1
);