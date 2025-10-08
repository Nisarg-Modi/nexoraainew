-- Add gender column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN gender text CHECK (gender IN ('male', 'female', 'other'));

COMMENT ON COLUMN public.profiles.gender IS 'User gender: male, female, or other';