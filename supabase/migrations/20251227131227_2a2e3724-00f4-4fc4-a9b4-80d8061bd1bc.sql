-- Add updated_at column to messages table
ALTER TABLE public.messages 
ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Create trigger to update updated_at when message content changes
CREATE OR REPLACE FUNCTION public.update_message_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.content IS DISTINCT FROM NEW.content THEN
    NEW.updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_messages_updated_at
BEFORE UPDATE ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.update_message_updated_at();