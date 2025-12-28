-- Create moments table for status-like updates
CREATE TABLE public.moments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  content TEXT,
  media_url TEXT,
  media_type TEXT DEFAULT 'text',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '24 hours'),
  views_count INTEGER DEFAULT 0
);

-- Create table to track who viewed moments
CREATE TABLE public.moment_views (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  moment_id UUID NOT NULL REFERENCES public.moments(id) ON DELETE CASCADE,
  viewer_id UUID NOT NULL,
  viewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(moment_id, viewer_id)
);

-- Enable RLS
ALTER TABLE public.moments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moment_views ENABLE ROW LEVEL SECURITY;

-- Moments policies
CREATE POLICY "Users can create their own moments"
ON public.moments FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view moments from contacts and own"
ON public.moments FOR SELECT
USING (
  auth.uid() = user_id OR
  EXISTS (
    SELECT 1 FROM public.contacts
    WHERE contacts.user_id = auth.uid()
    AND contacts.contact_user_id = moments.user_id
  )
);

CREATE POLICY "Users can delete their own moments"
ON public.moments FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own moments"
ON public.moments FOR UPDATE
USING (auth.uid() = user_id);

-- Moment views policies
CREATE POLICY "Users can insert views"
ON public.moment_views FOR INSERT
WITH CHECK (auth.uid() = viewer_id);

CREATE POLICY "Moment owners can view who saw their moments"
ON public.moment_views FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.moments
    WHERE moments.id = moment_views.moment_id
    AND moments.user_id = auth.uid()
  )
  OR auth.uid() = viewer_id
);

-- Create storage bucket for moments media
INSERT INTO storage.buckets (id, name, public) VALUES ('moments', 'moments', true);

-- Storage policies for moments bucket
CREATE POLICY "Users can upload their own moment media"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'moments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Anyone can view moment media"
ON storage.objects FOR SELECT
USING (bucket_id = 'moments');

CREATE POLICY "Users can delete their own moment media"
ON storage.objects FOR DELETE
USING (bucket_id = 'moments' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Enable realtime for moments
ALTER PUBLICATION supabase_realtime ADD TABLE public.moments;