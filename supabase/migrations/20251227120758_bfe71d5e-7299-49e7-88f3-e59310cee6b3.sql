-- Update can_view_profile function to restrict visibility in large groups
CREATE OR REPLACE FUNCTION public.can_view_profile(viewer_id uuid, profile_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    viewer_id = profile_user_id OR -- Own profile
    EXISTS ( -- User is in viewer's contacts
      SELECT 1 FROM contacts 
      WHERE user_id = viewer_id AND contact_user_id = profile_user_id
    ) OR
    EXISTS ( -- Users share a SMALL conversation (10 or fewer members)
      SELECT 1 FROM conversation_participants cp1
      INNER JOIN conversation_participants cp2 
        ON cp1.conversation_id = cp2.conversation_id
      WHERE cp1.user_id = viewer_id 
        AND cp2.user_id = profile_user_id
        AND (
          SELECT COUNT(*) 
          FROM conversation_participants 
          WHERE conversation_id = cp1.conversation_id
        ) <= 10
    );
$function$;