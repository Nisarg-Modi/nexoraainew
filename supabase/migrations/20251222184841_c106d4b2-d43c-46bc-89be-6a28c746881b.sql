-- Drop existing problematic policies
DROP POLICY IF EXISTS "view_invited_meetings" ON public.meetings;
DROP POLICY IF EXISTS "view_own_meetings" ON public.meetings;
DROP POLICY IF EXISTS "Users can view participants of meetings they're invited to" ON public.meeting_participants;
DROP POLICY IF EXISTS "Meeting creators can add participants" ON public.meeting_participants;

-- Create a helper function to check meeting access (avoids recursion)
CREATE OR REPLACE FUNCTION public.is_meeting_participant(meeting_uuid uuid, user_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM meeting_participants
    WHERE meeting_id = meeting_uuid AND user_id = user_uuid
  );
$$;

-- Create a helper function to check if user is meeting creator
CREATE OR REPLACE FUNCTION public.is_meeting_creator(meeting_uuid uuid, user_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM meetings
    WHERE id = meeting_uuid AND created_by = user_uuid
  );
$$;

-- Recreate meetings SELECT policy using the helper function
CREATE POLICY "users_can_view_meetings"
ON public.meetings
FOR SELECT
USING (
  created_by = auth.uid() 
  OR is_meeting_participant(id, auth.uid())
);

-- Recreate meeting_participants policies using helper functions
CREATE POLICY "users_can_view_meeting_participants"
ON public.meeting_participants
FOR SELECT
USING (
  user_id = auth.uid()
  OR is_meeting_creator(meeting_id, auth.uid())
  OR is_meeting_participant(meeting_id, auth.uid())
);

CREATE POLICY "creators_can_add_participants"
ON public.meeting_participants
FOR INSERT
WITH CHECK (
  is_meeting_creator(meeting_id, auth.uid())
);