-- Create a security definer function to search users for meeting invitations
-- This allows searching all users while maintaining security
CREATE OR REPLACE FUNCTION public.search_users_for_meeting(search_term text)
RETURNS TABLE(
  user_id uuid,
  display_name text,
  username text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only return basic, non-sensitive information
  RETURN QUERY
  SELECT 
    p.user_id,
    p.display_name,
    p.username
  FROM public.profiles p
  WHERE 
    p.username ILIKE '%' || search_term || '%'
    OR p.display_name ILIKE '%' || search_term || '%'
  LIMIT 10;
END;
$$;