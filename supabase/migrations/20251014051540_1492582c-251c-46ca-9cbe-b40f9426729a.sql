-- Add foreign key constraint for meeting_participants.user_id
ALTER TABLE public.meeting_participants
ADD CONSTRAINT meeting_participants_user_id_fkey
FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;