-- Fix profiles table policies - restrict all operations to authenticated users only
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can delete their own profile" ON public.profiles;

CREATE POLICY "Authenticated users can insert their own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can delete their own profile"
ON public.profiles
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Fix contacts table policies - restrict to authenticated users only
DROP POLICY IF EXISTS "Users can update their own contacts" ON public.contacts;
DROP POLICY IF EXISTS "Users can delete their own contacts" ON public.contacts;

CREATE POLICY "Authenticated users can update their own contacts"
ON public.contacts
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can delete their own contacts"
ON public.contacts
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- CRITICAL FIX: messages table SELECT policy is exposed to public!
DROP POLICY IF EXISTS "Users can view messages from their conversations" ON public.messages;

CREATE POLICY "Authenticated users can view messages from their conversations"
ON public.messages
FOR SELECT
TO authenticated
USING (is_conversation_participant(conversation_id, auth.uid()));