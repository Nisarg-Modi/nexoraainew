-- Create streams table for broadcast channels
CREATE TABLE public.streams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  avatar_url TEXT,
  created_by UUID NOT NULL,
  follower_count INTEGER DEFAULT 0,
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create stream_followers table
CREATE TABLE public.stream_followers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stream_id UUID NOT NULL REFERENCES public.streams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  followed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(stream_id, user_id)
);

-- Create stream_posts table for broadcast content
CREATE TABLE public.stream_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stream_id UUID NOT NULL REFERENCES public.streams(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  media_url TEXT,
  media_type TEXT DEFAULT 'text',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.streams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stream_followers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stream_posts ENABLE ROW LEVEL SECURITY;

-- Streams policies
CREATE POLICY "Anyone can view streams"
ON public.streams FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can create streams"
ON public.streams FOR INSERT
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Owners can update their streams"
ON public.streams FOR UPDATE
USING (auth.uid() = created_by);

CREATE POLICY "Owners can delete their streams"
ON public.streams FOR DELETE
USING (auth.uid() = created_by);

-- Stream followers policies
CREATE POLICY "Anyone can view followers"
ON public.stream_followers FOR SELECT
USING (true);

CREATE POLICY "Users can follow streams"
ON public.stream_followers FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unfollow streams"
ON public.stream_followers FOR DELETE
USING (auth.uid() = user_id);

-- Stream posts policies
CREATE POLICY "Anyone can view stream posts"
ON public.stream_posts FOR SELECT
USING (true);

CREATE POLICY "Stream owners can create posts"
ON public.stream_posts FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.streams
    WHERE streams.id = stream_posts.stream_id
    AND streams.created_by = auth.uid()
  )
);

CREATE POLICY "Stream owners can delete posts"
ON public.stream_posts FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.streams
    WHERE streams.id = stream_posts.stream_id
    AND streams.created_by = auth.uid()
  )
);

-- Function to update follower count
CREATE OR REPLACE FUNCTION public.update_stream_follower_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.streams
    SET follower_count = follower_count + 1, updated_at = now()
    WHERE id = NEW.stream_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.streams
    SET follower_count = GREATEST(follower_count - 1, 0), updated_at = now()
    WHERE id = OLD.stream_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Trigger to update follower count
CREATE TRIGGER update_stream_follower_count_trigger
AFTER INSERT OR DELETE ON public.stream_followers
FOR EACH ROW
EXECUTE FUNCTION public.update_stream_follower_count();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.streams;
ALTER PUBLICATION supabase_realtime ADD TABLE public.stream_posts;