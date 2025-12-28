-- Add Do Not Disturb settings to profiles table
ALTER TABLE public.profiles 
ADD COLUMN dnd_enabled boolean DEFAULT false,
ADD COLUMN dnd_start_time time DEFAULT '22:00:00',
ADD COLUMN dnd_end_time time DEFAULT '07:00:00';