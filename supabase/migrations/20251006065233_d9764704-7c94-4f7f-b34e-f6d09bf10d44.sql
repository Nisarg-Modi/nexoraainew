-- Create translation tracking table for rate limiting
CREATE TABLE public.message_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_id UUID NOT NULL,
  source_language TEXT NOT NULL,
  target_language TEXT NOT NULL,
  original_text TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.message_translations ENABLE ROW LEVEL SECURITY;

-- Users can view their own translations
CREATE POLICY "Users can view their own translations"
ON public.message_translations
FOR SELECT
USING (auth.uid() = user_id);

-- Users can create translations with rate limit (free: 50/day, premium: unlimited)
CREATE POLICY "Users can create translations"
ON public.message_translations
FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND (
    -- Premium users have unlimited translations
    has_premium_access(auth.uid()) OR
    -- Free users limited to 50 per day
    (
      SELECT COUNT(*) 
      FROM message_translations 
      WHERE user_id = auth.uid() 
      AND created_at > NOW() - INTERVAL '1 day'
    ) < 50
  )
);

-- Add user language preference to profiles
ALTER TABLE public.profiles 
ADD COLUMN preferred_language TEXT DEFAULT 'en',
ADD COLUMN auto_translate BOOLEAN DEFAULT false;

-- Create index for performance
CREATE INDEX idx_translations_user_date ON public.message_translations(user_id, created_at DESC);