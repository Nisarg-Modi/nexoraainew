-- Drop ALL existing policies on meetings table
DROP POLICY IF EXISTS "Creators can delete their meetings" ON meetings;
DROP POLICY IF EXISTS "Creators can update their meetings" ON meetings;
DROP POLICY IF EXISTS "Users can create meetings" ON meetings;
DROP POLICY IF EXISTS "Users can view meetings they created or are invited to" ON meetings;
DROP POLICY IF EXISTS "Users can view meetings they created" ON meetings;
DROP POLICY IF EXISTS "Users can view meetings as participants" ON meetings;

-- Recreate policies without recursion
CREATE POLICY "meeting_creators_can_delete"
ON meetings FOR DELETE
USING (auth.uid() = created_by);

CREATE POLICY "meeting_creators_can_update"
ON meetings FOR UPDATE
USING (auth.uid() = created_by);

CREATE POLICY "users_can_create_meetings"
ON meetings FOR INSERT
WITH CHECK (auth.uid() = created_by);

-- Separate SELECT policies to avoid recursion
CREATE POLICY "view_own_meetings"
ON meetings FOR SELECT
USING (auth.uid() = created_by);

CREATE POLICY "view_invited_meetings"
ON meetings FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM meeting_participants
    WHERE meeting_participants.meeting_id = meetings.id
    AND meeting_participants.user_id = auth.uid()
  )
);