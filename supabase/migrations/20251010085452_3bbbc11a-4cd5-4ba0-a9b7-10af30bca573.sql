-- Fix infinite recursion in call RLS policies

-- Drop the problematic policies
DROP POLICY IF EXISTS "Users can view calls they are part of" ON public.calls;
DROP POLICY IF EXISTS "Users can update calls they are part of" ON public.calls;
DROP POLICY IF EXISTS "Users can view call participants for their calls" ON public.call_participants;

-- Create a security definer function to check call participation (prevents recursion)
CREATE OR REPLACE FUNCTION public.is_call_participant(call_uuid uuid, user_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.call_participants
    WHERE call_id = call_uuid
      AND user_id = user_uuid
  );
$$;

-- Create a security definer function to check if user is caller
CREATE OR REPLACE FUNCTION public.is_caller(call_uuid uuid, user_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.calls
    WHERE id = call_uuid
      AND caller_id = user_uuid
  );
$$;

-- Recreate calls policies using security definer functions
CREATE POLICY "Users can view calls they are part of"
ON public.calls FOR SELECT
USING (
  caller_id = auth.uid() OR
  is_call_participant(id, auth.uid())
);

CREATE POLICY "Users can update calls they are part of"
ON public.calls FOR UPDATE
USING (
  caller_id = auth.uid() OR
  is_call_participant(id, auth.uid())
);

-- Recreate call_participants policies using security definer functions
CREATE POLICY "Users can view call participants for their calls"
ON public.call_participants FOR SELECT
USING (
  user_id = auth.uid() OR
  is_caller(call_id, auth.uid()) OR
  is_call_participant(call_id, auth.uid())
);