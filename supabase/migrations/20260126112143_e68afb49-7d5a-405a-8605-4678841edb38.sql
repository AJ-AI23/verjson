-- Fix get_workspace_permissions to remove email reference
CREATE OR REPLACE FUNCTION public.get_workspace_permissions(ws_id uuid)
 RETURNS TABLE(id uuid, workspace_id uuid, user_id uuid, role permission_role, granted_by uuid, created_at timestamp with time zone, updated_at timestamp with time zone, status text, user_email text, user_name text, username text, email_notifications_enabled boolean)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    wp.id,
    wp.workspace_id,
    wp.user_id,
    wp.role,
    wp.granted_by,
    wp.created_at,
    wp.updated_at,
    wp.status,
    NULL::text as user_email,
    p.full_name as user_name,
    p.username,
    wp.email_notifications_enabled
  FROM workspace_permissions wp
  LEFT JOIN profiles p ON wp.user_id = p.user_id
  WHERE wp.workspace_id = ws_id
  ORDER BY wp.created_at DESC;
$function$;