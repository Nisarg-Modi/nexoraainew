-- Drop the existing overly permissive policy
DROP POLICY IF EXISTS "Anyone can view streams" ON public.streams;

-- Create a more restrictive policy that only allows authenticated users to view streams
CREATE POLICY "Authenticated users can view streams"
ON public.streams
FOR SELECT
USING (auth.uid() IS NOT NULL);