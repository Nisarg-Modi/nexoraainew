-- Create bot_settings table for group bot configuration
CREATE TABLE public.bot_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  enabled BOOLEAN DEFAULT true,
  default_mode TEXT DEFAULT 'assistant',
  persona TEXT DEFAULT 'professional',
  auto_translate BOOLEAN DEFAULT false,
  target_language TEXT DEFAULT 'en',
  moderation_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(conversation_id)
);

-- Create bot_interactions table to track bot usage
CREATE TABLE public.bot_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  mode TEXT NOT NULL,
  command TEXT,
  response TEXT,
  confidence DECIMAL(3,2),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bot_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_interactions ENABLE ROW LEVEL SECURITY;

-- RLS policies for bot_settings
CREATE POLICY "Users can view bot settings for their conversations"
  ON public.bot_settings FOR SELECT
  USING (is_conversation_participant(conversation_id, auth.uid()));

CREATE POLICY "Conversation admins can update bot settings"
  ON public.bot_settings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM conversation_participants 
      WHERE conversation_id = bot_settings.conversation_id 
      AND user_id = auth.uid() 
      AND is_admin = true
    )
  );

CREATE POLICY "Conversation admins can insert bot settings"
  ON public.bot_settings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversation_participants 
      WHERE conversation_id = bot_settings.conversation_id 
      AND user_id = auth.uid() 
      AND is_admin = true
    )
  );

-- RLS policies for bot_interactions
CREATE POLICY "Users can view bot interactions in their conversations"
  ON public.bot_interactions FOR SELECT
  USING (is_conversation_participant(conversation_id, auth.uid()));

CREATE POLICY "System can insert bot interactions"
  ON public.bot_interactions FOR INSERT
  WITH CHECK (is_conversation_participant(conversation_id, auth.uid()));

-- Add indexes
CREATE INDEX idx_bot_settings_conversation ON bot_settings(conversation_id);
CREATE INDEX idx_bot_interactions_conversation ON bot_interactions(conversation_id);
CREATE INDEX idx_bot_interactions_created ON bot_interactions(created_at DESC);

-- Add trigger for updated_at
CREATE TRIGGER update_bot_settings_updated_at
  BEFORE UPDATE ON public.bot_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();