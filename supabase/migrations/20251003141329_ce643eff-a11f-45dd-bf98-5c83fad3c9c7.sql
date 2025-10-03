-- Add audio message support to messages table
ALTER TABLE public.messages 
ADD COLUMN audio_data text,
ADD COLUMN transcription text,
ADD COLUMN message_type text DEFAULT 'text' CHECK (message_type IN ('text', 'audio', 'image'));

-- Update content column to be nullable since audio messages might not have text content initially
ALTER TABLE public.messages 
ALTER COLUMN content DROP NOT NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.messages.audio_data IS 'Base64 encoded audio data for voice messages';
COMMENT ON COLUMN public.messages.transcription IS 'AI-generated transcription of audio messages';
COMMENT ON COLUMN public.messages.message_type IS 'Type of message: text, audio, or image';