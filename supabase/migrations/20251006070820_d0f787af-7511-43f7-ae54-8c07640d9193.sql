-- Create function to find user by username (case-insensitive)
CREATE OR REPLACE FUNCTION public.find_user_by_username(input_username text)
RETURNS TABLE(user_id uuid, display_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT p.user_id, p.display_name
  FROM public.profiles p
  WHERE LOWER(p.username) = LOWER(input_username);
END;
$function$;