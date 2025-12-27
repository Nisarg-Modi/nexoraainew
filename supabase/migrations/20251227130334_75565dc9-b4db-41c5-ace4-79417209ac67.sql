-- Drop the existing restrictive delete policy
DROP POLICY IF EXISTS "Messages cannot be deleted" ON public.messages;

-- Create a new policy allowing users to delete their own messages
CREATE POLICY "Users can delete their own messages"
ON public.messages
FOR DELETE
USING (auth.uid() = sender_id);