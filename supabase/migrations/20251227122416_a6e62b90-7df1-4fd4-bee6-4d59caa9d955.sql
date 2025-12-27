-- Create function to delete user avatar files when profile is deleted
-- This function is created in the PUBLIC schema (not storage) as required
CREATE OR REPLACE FUNCTION public.delete_user_avatar()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete avatar files from storage bucket
  -- Avatar files are stored with pattern: user_id/filename
  DELETE FROM storage.objects
  WHERE bucket_id = 'avatars'
    AND name LIKE OLD.user_id::text || '/%';
  
  -- Log the cleanup to audit log
  INSERT INTO public.security_audit_log (user_id, event_type, metadata)
  VALUES (
    OLD.user_id,
    'avatar_cleanup_on_profile_delete',
    jsonb_build_object(
      'profile_user_id', OLD.user_id,
      'timestamp', NOW()
    )
  );
  
  RETURN OLD;
END;
$$;

-- Create trigger to execute cleanup before profile deletion
CREATE TRIGGER cleanup_avatar_on_profile_delete
  BEFORE DELETE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.delete_user_avatar();