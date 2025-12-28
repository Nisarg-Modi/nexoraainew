-- Add send language preference to profiles table
-- preferred_language already exists for receiving/translation target
ALTER TABLE public.profiles 
ADD COLUMN send_language text DEFAULT 'en';