-- Create table for per-contact language preferences
CREATE TABLE public.contact_language_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  contact_user_id UUID NOT NULL,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  auto_translate BOOLEAN DEFAULT false,
  preferred_language TEXT DEFAULT 'en',
  send_language TEXT DEFAULT 'en',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, contact_user_id)
);

-- Enable RLS
ALTER TABLE public.contact_language_preferences ENABLE ROW LEVEL SECURITY;

-- Users can view their own contact language preferences
CREATE POLICY "Users can view their own contact language preferences"
ON public.contact_language_preferences
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own contact language preferences
CREATE POLICY "Users can insert their own contact language preferences"
ON public.contact_language_preferences
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own contact language preferences
CREATE POLICY "Users can update their own contact language preferences"
ON public.contact_language_preferences
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own contact language preferences
CREATE POLICY "Users can delete their own contact language preferences"
ON public.contact_language_preferences
FOR DELETE
USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_contact_language_preferences_updated_at
  BEFORE UPDATE ON public.contact_language_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();