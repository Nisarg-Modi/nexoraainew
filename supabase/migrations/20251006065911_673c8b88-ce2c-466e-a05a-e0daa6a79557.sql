-- First, update any existing profiles with NULL display_name to use username as fallback
UPDATE public.profiles 
SET display_name = COALESCE(username, 'User ' || substring(user_id::text, 1, 8))
WHERE display_name IS NULL;

-- Now make display_name NOT NULL
ALTER TABLE public.profiles 
ALTER COLUMN display_name SET NOT NULL;

-- Update the handle_new_user function to ensure display_name is always set
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, username)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'display_name',
      NEW.raw_user_meta_data->>'username',
      split_part(NEW.email, '@', 1)
    ),
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$function$;