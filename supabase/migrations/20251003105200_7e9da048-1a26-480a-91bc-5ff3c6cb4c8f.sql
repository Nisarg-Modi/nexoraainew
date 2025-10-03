-- Update default status message from Mercury to Nexora
ALTER TABLE public.profiles 
ALTER COLUMN status SET DEFAULT 'Hey there! I am using Nexora'::text;

-- Update existing users who still have the old Mercury status
UPDATE public.profiles 
SET status = 'Hey there! I am using Nexora'
WHERE status = 'Hey there! I am using Mercury';