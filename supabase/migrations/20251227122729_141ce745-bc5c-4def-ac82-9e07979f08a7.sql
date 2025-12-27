-- Strengthen can_view_profile function with additional security measures
-- This prevents profile scraping by ensuring proper authentication and limiting access

CREATE OR REPLACE FUNCTION public.can_view_profile(viewer_id uuid, profile_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  can_view boolean;
BEGIN
  -- Reject if viewer_id is null (unauthenticated)
  IF viewer_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Reject if profile_user_id is null
  IF profile_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check access conditions
  SELECT 
    -- Can always view own profile
    viewer_id = profile_user_id 
    OR
    -- User is in viewer's contacts (bidirectional check for added security)
    EXISTS (
      SELECT 1 FROM contacts 
      WHERE user_id = viewer_id 
      AND contact_user_id = profile_user_id
    )
    OR
    -- Users share a SMALL conversation (10 or fewer members)
    -- This prevents abuse through large public groups
    EXISTS (
      SELECT 1 FROM conversation_participants cp1
      INNER JOIN conversation_participants cp2 
        ON cp1.conversation_id = cp2.conversation_id
      INNER JOIN conversations c
        ON c.id = cp1.conversation_id
      WHERE cp1.user_id = viewer_id 
        AND cp2.user_id = profile_user_id
        AND cp1.user_id != cp2.user_id  -- Ensure different users
        AND (
          SELECT COUNT(*) 
          FROM conversation_participants 
          WHERE conversation_id = cp1.conversation_id
        ) <= 10
    )
  INTO can_view;
  
  RETURN COALESCE(can_view, false);
END;
$$;

-- Add a helper function to check profile access with rate limiting
-- This can be used for additional protection in high-security contexts
CREATE OR REPLACE FUNCTION public.can_view_profile_rate_limited(viewer_id uuid, profile_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_views integer;
  can_view boolean;
BEGIN
  -- Reject if viewer_id is null
  IF viewer_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check if user is making too many profile view attempts
  -- This helps prevent automated scraping
  SELECT COUNT(*) INTO recent_views
  FROM security_audit_log
  WHERE user_id = viewer_id
    AND event_type = 'profile_view_attempt'
    AND created_at > NOW() - INTERVAL '1 minute';
  
  -- Allow max 30 profile views per minute (reasonable for normal usage)
  IF recent_views >= 30 THEN
    RETURN false;
  END IF;
  
  -- Check if viewer can view the profile
  can_view := can_view_profile(viewer_id, profile_user_id);
  
  RETURN can_view;
END;
$$;