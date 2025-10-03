-- Ensure messages table has proper replica identity for realtime
ALTER TABLE public.messages REPLICA IDENTITY FULL;