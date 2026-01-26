-- Update get_document_permissions_with_inheritance to remove email reference
CREATE OR REPLACE FUNCTION public.get_document_permissions_with_inheritance(doc_id uuid)
 RETURNS TABLE(id uuid, document_id uuid, user_id uuid, role permission_role, granted_by uuid, created_at timestamp with time zone, updated_at timestamp with time zone, status text, user_email text, user_name text, username text, email_notifications_enabled boolean, inherited_from text, workspace_id uuid)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- Get explicit document permissions
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
    dp.email_notifications_enabled,
    'document'::text as inherited_from,
    d.workspace_id
  FROM document_permissions dp
  LEFT JOIN profiles p ON dp.user_id = p.user_id
  LEFT JOIN documents d ON dp.document_id = d.id
  WHERE dp.document_id = doc_id
  
  UNION ALL
  
  -- Get inherited workspace permissions (only for users who don't have explicit document permissions)
  SELECT 
    wp.id,
    doc_id as document_id,
    wp.user_id,
    wp.role,
    wp.granted_by,
    wp.created_at,
    wp.updated_at,
    wp.status,
    NULL::text as user_email,
    p.full_name as user_name,
    p.username,
    wp.email_notifications_enabled,
    'workspace'::text as inherited_from,
    wp.workspace_id
  FROM workspace_permissions wp
  LEFT JOIN profiles p ON wp.user_id = p.user_id
  LEFT JOIN documents d ON d.id = doc_id
  WHERE wp.workspace_id = d.workspace_id
    AND wp.status = 'accepted'
    AND NOT EXISTS (
      SELECT 1 FROM document_permissions dp 
      WHERE dp.document_id = doc_id 
        AND dp.user_id = wp.user_id
    )
  
  ORDER BY inherited_from ASC, created_at DESC;
$function$;