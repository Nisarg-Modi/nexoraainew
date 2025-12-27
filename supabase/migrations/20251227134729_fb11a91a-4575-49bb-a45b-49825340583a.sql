-- Create function to get unread message counts for all conversations of a user
CREATE OR REPLACE FUNCTION public.get_unread_counts(user_uuid uuid)
RETURNS TABLE(conversation_id uuid, unread_count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    m.conversation_id,
    COUNT(*) as unread_count
  FROM messages m
  JOIN conversation_participants cp ON m.conversation_id = cp.conversation_id
  WHERE cp.user_id = user_uuid
    AND m.sender_id != user_uuid
    AND m.read_at IS NULL
  GROUP BY m.conversation_id;
$$;

-- Create function to mark messages as read in a conversation
CREATE OR REPLACE FUNCTION public.mark_messages_read(conv_id uuid, user_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE messages
  SET read_at = NOW()
  WHERE conversation_id = conv_id
    AND sender_id != user_uuid
    AND read_at IS NULL;
END;
$$;