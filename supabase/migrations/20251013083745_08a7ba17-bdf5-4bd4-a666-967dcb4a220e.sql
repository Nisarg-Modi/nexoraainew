-- Create meetings table
CREATE TABLE public.meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  scheduled_start TIMESTAMP WITH TIME ZONE NOT NULL,
  scheduled_end TIMESTAMP WITH TIME ZONE NOT NULL,
  meeting_link TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'active', 'ended', 'cancelled')),
  is_video BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT valid_time_range CHECK (scheduled_end > scheduled_start)
);

-- Create meeting_participants table
CREATE TABLE public.meeting_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'accepted', 'declined', 'joined', 'left')),
  response_at TIMESTAMP WITH TIME ZONE,
  joined_at TIMESTAMP WITH TIME ZONE,
  left_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(meeting_id, user_id)
);

-- Enable RLS
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_participants ENABLE ROW LEVEL SECURITY;

-- RLS Policies for meetings
CREATE POLICY "Users can create meetings"
  ON public.meetings FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can view meetings they created or are invited to"
  ON public.meetings FOR SELECT
  USING (
    auth.uid() = created_by OR
    EXISTS (
      SELECT 1 FROM public.meeting_participants
      WHERE meeting_id = meetings.id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Creators can update their meetings"
  ON public.meetings FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Creators can delete their meetings"
  ON public.meetings FOR DELETE
  USING (auth.uid() = created_by);

-- RLS Policies for meeting_participants
CREATE POLICY "Meeting creators can add participants"
  ON public.meeting_participants FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.meetings
      WHERE id = meeting_id AND created_by = auth.uid()
    )
  );

CREATE POLICY "Users can view participants of meetings they're invited to"
  ON public.meeting_participants FOR SELECT
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.meetings
      WHERE id = meeting_id AND created_by = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.meeting_participants mp
      WHERE mp.meeting_id = meeting_participants.meeting_id AND mp.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own participant status"
  ON public.meeting_participants FOR UPDATE
  USING (user_id = auth.uid());

-- Create indexes for performance
CREATE INDEX idx_meetings_created_by ON public.meetings(created_by);
CREATE INDEX idx_meetings_scheduled_start ON public.meetings(scheduled_start);
CREATE INDEX idx_meetings_status ON public.meetings(status);
CREATE INDEX idx_meeting_participants_meeting_id ON public.meeting_participants(meeting_id);
CREATE INDEX idx_meeting_participants_user_id ON public.meeting_participants(user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_meetings_updated_at
  BEFORE UPDATE ON public.meetings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();