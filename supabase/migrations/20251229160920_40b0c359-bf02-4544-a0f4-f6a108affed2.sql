-- Fix stream_followers: require authentication
DROP POLICY IF EXISTS "Anyone can view followers" ON public.stream_followers;
CREATE POLICY "Authenticated users can view followers"
ON public.stream_followers
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Fix stream_posts: require authentication
DROP POLICY IF EXISTS "Anyone can view stream posts" ON public.stream_posts;
CREATE POLICY "Authenticated users can view stream posts"
ON public.stream_posts
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Fix stream_post_reactions: require authentication
DROP POLICY IF EXISTS "Anyone can view reactions" ON public.stream_post_reactions;
CREATE POLICY "Authenticated users can view reactions"
ON public.stream_post_reactions
FOR SELECT
USING (auth.uid() IS NOT NULL);