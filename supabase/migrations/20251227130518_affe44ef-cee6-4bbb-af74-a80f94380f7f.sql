-- Drop the restrictive update policy
DROP POLICY IF EXISTS "Messages are immutable - no updates" ON public.messages;

-- Create policy allowing users to update their own messages
CREATE POLICY "Users can update their own messages"
ON public.messages
FOR UPDATE
USING (auth.uid() = sender_id)
WITH CHECK (auth.uid() = sender_id);