-- Drop duplicate/conflicting RLS policies on calls table
DROP POLICY IF EXISTS "Users can create calls" ON public.calls;
DROP POLICY IF EXISTS "Users can view calls they are part of" ON public.calls;
DROP POLICY IF EXISTS "Users can update calls they are part of" ON public.calls;

-- Keep the conversation-based policies which are more comprehensive:
-- "Users can create calls in their conversations" 
-- "Users can view calls in their conversations"
-- "Users can update calls they're part of"