-- Add username to profiles and make it unique
ALTER TABLE public.profiles
ADD COLUMN username TEXT UNIQUE;

-- Update existing profiles to have usernames (from email prefix)
UPDATE public.profiles
SET username = split_part((SELECT email FROM auth.users WHERE id = user_id), '@', 1)
WHERE username IS NULL;

-- Make username required
ALTER TABLE public.profiles
ALTER COLUMN username SET NOT NULL;

-- Update the handle_new_user function to create username
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, username)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$;

-- Function to get user email by username for login
CREATE OR REPLACE FUNCTION public.get_email_by_username(input_username TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email TEXT;
BEGIN
  SELECT u.email INTO user_email
  FROM auth.users u
  INNER JOIN public.profiles p ON p.user_id = u.id
  WHERE LOWER(p.username) = LOWER(input_username);
  
  RETURN user_email;
END;
$$;