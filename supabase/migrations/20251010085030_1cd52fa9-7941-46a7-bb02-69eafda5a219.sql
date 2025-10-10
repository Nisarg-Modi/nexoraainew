-- Fix RLS policies for calls and call_participants tables

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view their calls" ON public.calls;
DROP POLICY IF EXISTS "Users can create calls" ON public.calls;
DROP POLICY IF EXISTS "Users can update their calls" ON public.calls;
DROP POLICY IF EXISTS "Users can view call participants" ON public.call_participants;
DROP POLICY IF EXISTS "Users can insert call participants" ON public.call_participants;
DROP POLICY IF EXISTS "Users can update call participants" ON public.call_participants;

-- Enable RLS on both tables
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_participants ENABLE ROW LEVEL SECURITY;

-- Calls table policies
CREATE POLICY "Users can view calls they are part of"
ON public.calls FOR SELECT
USING (
  caller_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.call_participants
    WHERE call_participants.call_id = calls.id
    AND call_participants.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create calls"
ON public.calls FOR INSERT
WITH CHECK (caller_id = auth.uid());

CREATE POLICY "Users can update calls they are part of"
ON public.calls FOR UPDATE
USING (
  caller_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.call_participants
    WHERE call_participants.call_id = calls.id
    AND call_participants.user_id = auth.uid()
  )
);

-- Call participants policies
CREATE POLICY "Users can view call participants for their calls"
ON public.call_participants FOR SELECT
USING (
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.calls
    WHERE calls.id = call_participants.call_id
    AND calls.caller_id = auth.uid()
  ) OR
  EXISTS (
    SELECT 1 FROM public.call_participants cp
    WHERE cp.call_id = call_participants.call_id
    AND cp.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert call participants"
ON public.call_participants FOR INSERT
WITH CHECK (
  -- User can insert themselves
  user_id = auth.uid() OR
  -- Caller can insert other participants
  EXISTS (
    SELECT 1 FROM public.calls
    WHERE calls.id = call_participants.call_id
    AND calls.caller_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own participant status"
ON public.call_participants FOR UPDATE
USING (user_id = auth.uid());