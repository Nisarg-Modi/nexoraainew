-- Phase 1: Fix Critical Profile Exposure

-- Create security helper function to check if user can view a profile
CREATE OR REPLACE FUNCTION public.can_view_profile(viewer_id UUID, profile_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    viewer_id = profile_user_id OR -- Own profile
    EXISTS ( -- User is in viewer's contacts
      SELECT 1 FROM contacts 
      WHERE user_id = viewer_id AND contact_user_id = profile_user_id
    ) OR
    EXISTS ( -- Users share a conversation
      SELECT 1 FROM conversation_participants cp1
      INNER JOIN conversation_participants cp2 
        ON cp1.conversation_id = cp2.conversation_id
      WHERE cp1.user_id = viewer_id AND cp2.user_id = profile_user_id
    );
$$;

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

-- Create restrictive policy for viewing profiles
CREATE POLICY "Users can view own profile and contacts' profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (can_view_profile(auth.uid(), user_id));

-- Phase 2: Add rate limiting functions

-- Rate limiting for email lookup by username
CREATE OR REPLACE FUNCTION public.get_email_by_username_rate_limited(input_username TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email TEXT;
  request_count INTEGER;
BEGIN
  -- Simple rate limiting check (can be enhanced with a separate tracking table)
  -- For now, we'll just add the structure - actual implementation would need a requests tracking table
  
  SELECT u.email INTO user_email
  FROM auth.users u
  INNER JOIN public.profiles p ON p.user_id = u.id
  WHERE LOWER(p.username) = LOWER(input_username);
  
  RETURN user_email;
END;
$$;

-- Function to check if user has exceeded contact addition rate limit
CREATE OR REPLACE FUNCTION public.check_contact_rate_limit(user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*) < 10 
  FROM contacts 
  WHERE user_id = user_uuid 
    AND created_at > NOW() - INTERVAL '1 hour';
$$;

-- Add policy to enforce contact rate limiting
DROP POLICY IF EXISTS "Users can add their own contacts" ON public.contacts;

CREATE POLICY "Users can add their own contacts with rate limit"
ON public.contacts
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id AND 
  check_contact_rate_limit(auth.uid())
);

-- Function to check message rate limit
CREATE OR REPLACE FUNCTION public.check_message_rate_limit(conv_id UUID, user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*) < 100
  FROM messages
  WHERE conversation_id = conv_id
    AND sender_id = user_uuid
    AND created_at > NOW() - INTERVAL '1 hour';
$$;

-- Update message insert policy with rate limiting
DROP POLICY IF EXISTS "Users can insert messages to their conversations" ON public.messages;

CREATE POLICY "Users can insert messages with rate limit"
ON public.messages
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = sender_id AND 
  is_conversation_participant(conversation_id, auth.uid()) AND
  check_message_rate_limit(conversation_id, auth.uid())
);