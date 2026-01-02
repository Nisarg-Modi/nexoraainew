-- Create table for AI chat conversations
CREATE TABLE public.ai_chat_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New Chat',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX idx_ai_chat_conversations_user_id ON public.ai_chat_conversations(user_id);
CREATE INDEX idx_ai_chat_conversations_updated_at ON public.ai_chat_conversations(updated_at DESC);

-- Enable RLS
ALTER TABLE public.ai_chat_conversations ENABLE ROW LEVEL SECURITY;

-- Users can only view their own conversations
CREATE POLICY "Users can view their own AI chat conversations"
ON public.ai_chat_conversations
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own conversations
CREATE POLICY "Users can insert their own AI chat conversations"
ON public.ai_chat_conversations
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own conversations
CREATE POLICY "Users can update their own AI chat conversations"
ON public.ai_chat_conversations
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own conversations
CREATE POLICY "Users can delete their own AI chat conversations"
ON public.ai_chat_conversations
FOR DELETE
USING (auth.uid() = user_id);

-- Add conversation_id to ai_chat_messages
ALTER TABLE public.ai_chat_messages 
ADD COLUMN conversation_id UUID REFERENCES public.ai_chat_conversations(id) ON DELETE CASCADE;

-- Create index for the new foreign key
CREATE INDEX idx_ai_chat_messages_conversation_id ON public.ai_chat_messages(conversation_id);

-- Create trigger to update conversation's updated_at when messages are added
CREATE OR REPLACE FUNCTION public.update_ai_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.ai_chat_conversations
  SET updated_at = now()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER update_ai_conversation_on_message
AFTER INSERT ON public.ai_chat_messages
FOR EACH ROW
WHEN (NEW.conversation_id IS NOT NULL)
EXECUTE FUNCTION public.update_ai_conversation_timestamp();