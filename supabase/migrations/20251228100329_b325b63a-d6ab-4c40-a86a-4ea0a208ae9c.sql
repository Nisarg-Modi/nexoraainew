-- Drop the foreign key constraint on security_audit_log that's causing delete failures
-- Audit logs should persist even after user deletion for security purposes
ALTER TABLE public.security_audit_log 
DROP CONSTRAINT IF EXISTS security_audit_log_user_id_fkey;

-- Also update the delete_user_avatar trigger to not insert audit log during cascade delete
-- since the user is being deleted anyway
CREATE OR REPLACE FUNCTION public.delete_user_avatar()
RETURNS trigger
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
  
  -- Note: We don't log here anymore since the user is being deleted
  -- and the security_audit_log cannot reference a deleted user
  
  RETURN OLD;
END;
$$;