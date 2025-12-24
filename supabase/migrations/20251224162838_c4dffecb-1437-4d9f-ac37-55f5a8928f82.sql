-- Create push_subscriptions table for storing user push notification subscriptions
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL,
  subscription JSONB NOT NULL,
  platform TEXT NOT NULL DEFAULT 'web',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster lookups by user_id
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);

-- Create unique index on endpoint to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint ON public.push_subscriptions(endpoint);

-- Enable RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can insert their own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can update their own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can delete their own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Service role can manage all push subscriptions" ON public.push_subscriptions;

-- Users can view their own subscriptions
CREATE POLICY "Users can view their own push subscriptions"
ON public.push_subscriptions
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own subscriptions
CREATE POLICY "Users can insert their own push subscriptions"
ON public.push_subscriptions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own subscriptions
CREATE POLICY "Users can update their own push subscriptions"
ON public.push_subscriptions
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own push subscriptions
CREATE POLICY "Users can delete their own push subscriptions"
ON public.push_subscriptions
FOR DELETE
USING (auth.uid() = user_id);