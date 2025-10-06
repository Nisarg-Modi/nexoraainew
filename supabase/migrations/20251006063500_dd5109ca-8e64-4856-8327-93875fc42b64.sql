-- Create RPC function for semantic search
CREATE OR REPLACE FUNCTION public.semantic_search(
  query_embedding vector(768),
  user_id UUID,
  conversation_filter UUID DEFAULT NULL,
  sender_filter UUID DEFAULT NULL,
  start_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  end_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  message_type_filter TEXT DEFAULT NULL,
  match_threshold FLOAT DEFAULT 0.5,
  match_count INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  message_id UUID,
  conversation_id UUID,
  content_preview TEXT,
  content TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  sender_id UUID,
  message_type TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    me.id,
    me.message_id,
    me.conversation_id,
    me.content_preview,
    m.content,
    me.created_at,
    m.sender_id,
    m.message_type,
    1 - (me.embedding <=> query_embedding) as similarity
  FROM message_embeddings me
  JOIN messages m ON me.message_id = m.id
  JOIN conversation_participants cp ON me.conversation_id = cp.conversation_id
  WHERE cp.user_id = semantic_search.user_id
    AND (1 - (me.embedding <=> query_embedding)) > match_threshold
    AND (conversation_filter IS NULL OR me.conversation_id = conversation_filter)
    AND (sender_filter IS NULL OR m.sender_id = sender_filter)
    AND (start_date IS NULL OR me.created_at >= start_date)
    AND (end_date IS NULL OR me.created_at <= end_date)
    AND (message_type_filter IS NULL OR m.message_type = message_type_filter)
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;