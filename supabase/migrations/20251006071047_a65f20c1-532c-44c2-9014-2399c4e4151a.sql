-- Add group chat support to conversations table
ALTER TABLE public.conversations
ADD COLUMN is_group BOOLEAN DEFAULT false,
ADD COLUMN group_name TEXT,
ADD COLUMN group_avatar_url TEXT,
ADD COLUMN created_by UUID REFERENCES auth.users(id);

-- Update conversation_participants to track admin status
ALTER TABLE public.conversation_participants
ADD COLUMN is_admin BOOLEAN DEFAULT false;

-- Create function to create group conversation
CREATE OR REPLACE FUNCTION public.create_group_conversation(
  p_group_name text,
  p_member_ids uuid[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_conversation_id UUID;
  current_user_id UUID;
  member_id UUID;
BEGIN
  current_user_id := auth.uid();
  
  -- Create the group conversation
  INSERT INTO conversations (is_group, group_name, created_by)
  VALUES (true, p_group_name, current_user_id)
  RETURNING id INTO v_conversation_id;
  
  -- Add the creator as admin
  INSERT INTO conversation_participants (conversation_id, user_id, is_admin)
  VALUES (v_conversation_id, current_user_id, true);
  
  -- Add all members
  FOREACH member_id IN ARRAY p_member_ids
  LOOP
    IF member_id != current_user_id THEN
      INSERT INTO conversation_participants (conversation_id, user_id, is_admin)
      VALUES (v_conversation_id, member_id, false)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
  
  RETURN v_conversation_id;
END;
$function$;

-- Update get_or_create_conversation to handle direct messages only
CREATE OR REPLACE FUNCTION public.get_or_create_conversation(other_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_conversation_id UUID;
  current_user_id UUID;
BEGIN
  current_user_id := auth.uid();
  
  -- Check if direct conversation already exists (not group)
  SELECT cp1.conversation_id INTO v_conversation_id
  FROM conversation_participants cp1
  INNER JOIN conversation_participants cp2 
    ON cp1.conversation_id = cp2.conversation_id
  INNER JOIN conversations c
    ON c.id = cp1.conversation_id
  WHERE cp1.user_id = current_user_id
    AND cp2.user_id = other_user_id
    AND c.is_group = false
    AND (
      SELECT COUNT(*) 
      FROM conversation_participants cp3
      WHERE cp3.conversation_id = cp1.conversation_id
    ) = 2;
  
  -- If no conversation exists, create one
  IF v_conversation_id IS NULL THEN
    INSERT INTO conversations (is_group, created_by)
    VALUES (false, current_user_id)
    RETURNING id INTO v_conversation_id;
    
    -- Add both participants
    INSERT INTO conversation_participants (conversation_id, user_id)
    VALUES 
      (v_conversation_id, current_user_id),
      (v_conversation_id, other_user_id);
  END IF;
  
  RETURN v_conversation_id;
END;
$function$;

-- Create function to add member to group
CREATE OR REPLACE FUNCTION public.add_group_member(
  p_conversation_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  is_user_admin BOOLEAN;
BEGIN
  -- Check if requester is admin
  SELECT is_admin INTO is_user_admin
  FROM conversation_participants
  WHERE conversation_id = p_conversation_id
    AND user_id = auth.uid();
  
  IF NOT COALESCE(is_user_admin, false) THEN
    RAISE EXCEPTION 'Only admins can add members';
  END IF;
  
  -- Add the member
  INSERT INTO conversation_participants (conversation_id, user_id, is_admin)
  VALUES (p_conversation_id, p_user_id, false)
  ON CONFLICT DO NOTHING;
  
  RETURN true;
END;
$function$;

-- Create index for performance
CREATE INDEX idx_conversations_is_group ON public.conversations(is_group);
CREATE INDEX idx_conversation_participants_admin ON public.conversation_participants(is_admin) WHERE is_admin = true;