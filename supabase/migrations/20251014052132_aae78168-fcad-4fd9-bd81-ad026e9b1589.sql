-- Create meeting_transcripts table to store transcriptions
CREATE TABLE public.meeting_transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  speaker_id UUID NOT NULL,
  content TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  translated_content JSONB, -- Store translations as { "es": "Hola", "fr": "Bonjour", ... }
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.meeting_transcripts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Meeting participants can view transcripts"
  ON public.meeting_transcripts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.meeting_participants
      WHERE meeting_id = meeting_transcripts.meeting_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert transcripts"
  ON public.meeting_transcripts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.meeting_participants
      WHERE meeting_id = meeting_transcripts.meeting_id AND user_id = auth.uid()
    )
  );

-- Create indexes
CREATE INDEX idx_meeting_transcripts_meeting_id ON public.meeting_transcripts(meeting_id);
CREATE INDEX idx_meeting_transcripts_timestamp ON public.meeting_transcripts(timestamp);