-- Fix user deletion failing due to FK from conversations.created_by -> auth.users
-- Keep conversations, but null out creator when that user is deleted
ALTER TABLE public.conversations
DROP CONSTRAINT IF EXISTS conversations_created_by_fkey;

ALTER TABLE public.conversations
ADD CONSTRAINT conversations_created_by_fkey
FOREIGN KEY (created_by)
REFERENCES auth.users(id)
ON DELETE SET NULL;