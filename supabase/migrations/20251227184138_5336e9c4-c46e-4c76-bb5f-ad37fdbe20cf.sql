-- Add is_muted column to conversation_participants table
ALTER TABLE public.conversation_participants 
ADD COLUMN is_muted boolean DEFAULT false;

-- Create policy to allow users to update their own mute settings
CREATE POLICY "Users can update their own participant settings"
ON public.conversation_participants
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);