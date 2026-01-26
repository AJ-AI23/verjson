-- Update get_document_permissions to remove email reference
CREATE OR REPLACE FUNCTION public.get_document_permissions(doc_id uuid)
 RETURNS TABLE(id uuid, document_id uuid, user_id uuid, role permission_role, granted_by uuid, created_at timestamp with time zone, updated_at timestamp with time zone, status text, user_email text, user_name text, username text, email_notifications_enabled boolean)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    dp.id,
    dp.document_id,
    dp.user_id,
    dp.role,
    dp.granted_by,
    dp.created_at,
    dp.updated_at,
    dp.status,
    NULL::text as user_email,
    p.full_name as user_name,
    p.username,
    dp.email_notifications_enabled
  FROM document_permissions dp
  LEFT JOIN profiles p ON dp.user_id = p.user_id
  WHERE dp.document_id = doc_id
  ORDER BY dp.created_at DESC;
$function$;