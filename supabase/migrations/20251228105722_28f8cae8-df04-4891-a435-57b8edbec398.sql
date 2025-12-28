-- Create communities table
CREATE TABLE public.communities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  avatar_url TEXT,
  created_by UUID NOT NULL,
  is_public BOOLEAN DEFAULT true,
  member_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create community_members table
CREATE TABLE public.community_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(community_id, user_id)
);

-- Enable RLS
ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_members ENABLE ROW LEVEL SECURITY;

-- Communities policies
CREATE POLICY "Anyone can view public communities"
ON public.communities FOR SELECT
USING (is_public = true OR created_by = auth.uid() OR EXISTS (
  SELECT 1 FROM public.community_members
  WHERE community_members.community_id = communities.id
  AND community_members.user_id = auth.uid()
));

CREATE POLICY "Authenticated users can create communities"
ON public.communities FOR INSERT
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Owners can update their communities"
ON public.communities FOR UPDATE
USING (auth.uid() = created_by);

CREATE POLICY "Owners can delete their communities"
ON public.communities FOR DELETE
USING (auth.uid() = created_by);

-- Community members policies
CREATE POLICY "Members can view community membership"
ON public.community_members FOR SELECT
USING (
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.community_members cm
    WHERE cm.community_id = community_members.community_id
    AND cm.user_id = auth.uid()
  )
);

CREATE POLICY "Users can join public communities"
ON public.community_members FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  (
    EXISTS (
      SELECT 1 FROM public.communities
      WHERE communities.id = community_members.community_id
      AND communities.is_public = true
    )
    OR
    EXISTS (
      SELECT 1 FROM public.communities
      WHERE communities.id = community_members.community_id
      AND communities.created_by = auth.uid()
    )
  )
);

CREATE POLICY "Users can leave communities"
ON public.community_members FOR DELETE
USING (auth.uid() = user_id);

-- Function to update member count
CREATE OR REPLACE FUNCTION public.update_community_member_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.communities
    SET member_count = member_count + 1, updated_at = now()
    WHERE id = NEW.community_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.communities
    SET member_count = GREATEST(member_count - 1, 0), updated_at = now()
    WHERE id = OLD.community_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Trigger to update member count
CREATE TRIGGER update_community_member_count_trigger
AFTER INSERT OR DELETE ON public.community_members
FOR EACH ROW
EXECUTE FUNCTION public.update_community_member_count();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.communities;
ALTER PUBLICATION supabase_realtime ADD TABLE public.community_members;