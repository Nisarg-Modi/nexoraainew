-- Create stream post reactions table
CREATE TABLE public.stream_post_reactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.stream_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  emoji TEXT NOT NULL DEFAULT '❤️',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id, emoji)
);

-- Enable RLS
ALTER TABLE public.stream_post_reactions ENABLE ROW LEVEL SECURITY;

-- Anyone can view reactions
CREATE POLICY "Anyone can view reactions"
ON public.stream_post_reactions
FOR SELECT
USING (true);

-- Authenticated users can add reactions
CREATE POLICY "Users can add reactions"
ON public.stream_post_reactions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can remove their own reactions
CREATE POLICY "Users can remove their reactions"
ON public.stream_post_reactions
FOR DELETE
USING (auth.uid() = user_id);

-- Add index for faster queries
CREATE INDEX idx_stream_post_reactions_post_id ON public.stream_post_reactions(post_id);

-- Enable realtime for reactions
ALTER PUBLICATION supabase_realtime ADD TABLE public.stream_post_reactions;