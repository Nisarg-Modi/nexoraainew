-- Add is_favourite column to contacts table
ALTER TABLE public.contacts 
ADD COLUMN is_favourite boolean DEFAULT false;

-- Create index for faster favourite lookups
CREATE INDEX idx_contacts_favourite ON public.contacts(user_id, is_favourite) WHERE is_favourite = true;