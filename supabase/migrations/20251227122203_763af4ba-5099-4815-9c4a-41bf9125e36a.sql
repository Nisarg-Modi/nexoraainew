-- Fix search_users_for_meeting to restrict searches to contacts/connections network
-- This prevents user enumeration by only allowing searches within the user's network

CREATE OR REPLACE FUNCTION public.search_users_for_meeting(search_term text)
RETURNS TABLE(user_id uuid, display_name text, username text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
BEGIN
  current_user_id := auth.uid();
  
  -- Require authentication
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  -- Validate input - prevent empty or too short searches
  IF search_term IS NULL OR length(trim(search_term)) < 2 THEN
    RAISE EXCEPTION 'Search term must be at least 2 characters';
  END IF;
  
  RETURN QUERY
  SELECT p.user_id, p.display_name, p.username
  FROM public.profiles p
  WHERE 
    (p.username ILIKE '%' || search_term || '%' 
     OR p.display_name ILIKE '%' || search_term || '%')
    AND (
      -- Allow searching for self
      p.user_id = current_user_id
      OR
      -- Must be in contacts
      EXISTS (
        SELECT 1 FROM contacts c 
        WHERE c.user_id = current_user_id 
        AND c.contact_user_id = p.user_id
      )
      OR
      -- Or share a conversation (limited to small groups < 20 people for privacy)
      EXISTS (
        SELECT 1 FROM conversation_participants cp1
        JOIN conversation_participants cp2 ON cp1.conversation_id = cp2.conversation_id
        WHERE cp1.user_id = current_user_id 
        AND cp2.user_id = p.user_id
        AND (
          SELECT COUNT(*) 
          FROM conversation_participants 
          WHERE conversation_id = cp1.conversation_id
        ) < 20
      )
    )
  LIMIT 10;
END;
$$;