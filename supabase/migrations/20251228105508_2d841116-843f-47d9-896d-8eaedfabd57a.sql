-- Create moment_replies table for reactions and text replies
CREATE TABLE public.moment_replies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  moment_id UUID NOT NULL REFERENCES public.moments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT,
  emoji TEXT,
  reply_type TEXT NOT NULL DEFAULT 'text' CHECK (reply_type IN ('text', 'reaction')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.moment_replies ENABLE ROW LEVEL SECURITY;

-- Users can reply to moments they can view
CREATE POLICY "Users can insert replies to viewable moments"
ON public.moment_replies FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM public.moments m
    WHERE m.id = moment_replies.moment_id
    AND (
      m.user_id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM public.contacts
        WHERE contacts.user_id = auth.uid()
        AND contacts.contact_user_id = m.user_id
      )
    )
  )
);

-- Moment owners can see all replies, users can see their own replies
CREATE POLICY "Users can view replies"
ON public.moment_replies FOR SELECT
USING (
  auth.uid() = user_id OR
  EXISTS (
    SELECT 1 FROM public.moments m
    WHERE m.id = moment_replies.moment_id
    AND m.user_id = auth.uid()
  )
);

-- Users can delete their own replies
CREATE POLICY "Users can delete their own replies"
ON public.moment_replies FOR DELETE
USING (auth.uid() = user_id);

-- Enable realtime for replies
ALTER PUBLICATION supabase_realtime ADD TABLE public.moment_replies;