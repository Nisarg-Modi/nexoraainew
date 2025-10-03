-- Create security definer function to check if user is in conversation
CREATE OR REPLACE FUNCTION public.is_conversation_participant(conversation_uuid uuid, user_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM conversation_participants
    WHERE conversation_id = conversation_uuid
      AND user_id = user_uuid
  );
$$;

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can add participants to conversations" ON conversation_participants;
DROP POLICY IF EXISTS "Users can view conversation participants" ON conversation_participants;
DROP POLICY IF EXISTS "Users can insert messages to their conversations" ON messages;
DROP POLICY IF EXISTS "Users can view messages from their conversations" ON messages;

-- Create new policies using the security definer function
CREATE POLICY "Users can add participants to conversations"
ON conversation_participants
FOR INSERT
WITH CHECK (
  user_id = auth.uid() OR 
  public.is_conversation_participant(conversation_id, auth.uid())
);

CREATE POLICY "Users can view conversation participants"
ON conversation_participants
FOR SELECT
USING (public.is_conversation_participant(conversation_id, auth.uid()));

CREATE POLICY "Users can insert messages to their conversations"
ON messages
FOR INSERT
WITH CHECK (
  auth.uid() = sender_id AND 
  public.is_conversation_participant(conversation_id, auth.uid())
);

CREATE POLICY "Users can view messages from their conversations"
ON messages
FOR SELECT
USING (public.is_conversation_participant(conversation_id, auth.uid()));