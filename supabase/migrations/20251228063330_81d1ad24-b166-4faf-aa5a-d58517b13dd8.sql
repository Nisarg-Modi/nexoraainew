-- Add global notification sound setting to profiles table
ALTER TABLE public.profiles 
ADD COLUMN notification_sound_enabled boolean DEFAULT true;

-- Add per-contact notification sound setting to contacts table
ALTER TABLE public.contacts 
ADD COLUMN notification_sound_enabled boolean DEFAULT true;