-- Create calls table to track call state
CREATE TABLE public.calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  caller_id uuid NOT NULL,
  call_type text NOT NULL CHECK (call_type IN ('audio', 'video')),
  status text NOT NULL DEFAULT 'ringing' CHECK (status IN ('ringing', 'active', 'ended', 'missed', 'rejected')),
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  ended_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create call_participants table for tracking who's in the call
CREATE TABLE public.call_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id uuid NOT NULL REFERENCES public.calls(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  joined_at timestamp with time zone DEFAULT now(),
  left_at timestamp with time zone,
  status text NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'joined', 'left', 'rejected')),
  UNIQUE(call_id, user_id)
);

-- Enable RLS
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_participants ENABLE ROW LEVEL SECURITY;

-- RLS Policies for calls
CREATE POLICY "Users can view calls in their conversations"
  ON public.calls
  FOR SELECT
  USING (is_conversation_participant(conversation_id, auth.uid()));

CREATE POLICY "Users can create calls in their conversations"
  ON public.calls
  FOR INSERT
  WITH CHECK (
    auth.uid() = caller_id 
    AND is_conversation_participant(conversation_id, auth.uid())
  );

CREATE POLICY "Users can update calls they're part of"
  ON public.calls
  FOR UPDATE
  USING (is_conversation_participant(conversation_id, auth.uid()));

-- RLS Policies for call_participants
CREATE POLICY "Users can view call participants"
  ON public.call_participants
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.calls
      WHERE calls.id = call_participants.call_id
        AND is_conversation_participant(calls.conversation_id, auth.uid())
    )
  );

CREATE POLICY "Users can join calls"
  ON public.call_participants
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.calls
      WHERE calls.id = call_participants.call_id
        AND is_conversation_participant(calls.conversation_id, auth.uid())
    )
  );

CREATE POLICY "Users can update their own participation"
  ON public.call_participants
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;
ALTER PUBLICATION supabase_realtime ADD TABLE public.call_participants;