-- Drop existing function first since return type is changing
DROP FUNCTION IF EXISTS public.get_user_invitations(uuid);

-- Recreate get_user_invitations to remove email references
CREATE OR REPLACE FUNCTION public.get_user_invitations(target_user_id uuid)
 RETURNS TABLE(id uuid, type text, workspace_id uuid, workspace_name text, document_id uuid, document_name text, role permission_role, created_at timestamp with time zone, inviter_email text, inviter_name text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- Workspace invitations
  SELECT 
    wp.id,
    'workspace'::text as type,
    wp.workspace_id,
    w.name as workspace_name,
    NULL::uuid as document_id,
    NULL::text as document_name,
    wp.role,
    wp.created_at,
    NULL::text as inviter_email,
    inviter.full_name as inviter_name
  FROM workspace_permissions wp
  JOIN workspaces w ON wp.workspace_id = w.id
  LEFT JOIN profiles inviter ON wp.granted_by = inviter.user_id
  WHERE wp.user_id = target_user_id
    AND wp.status = 'pending'
  
  UNION ALL
  
  -- Document invitations
  SELECT 
    dp.id,
    'document'::text as type,
    d.workspace_id,
    w.name as workspace_name,
    dp.document_id,
    d.name as document_name,
    dp.role,
    dp.created_at,
    NULL::text as inviter_email,
    inviter.full_name as inviter_name
  FROM document_permissions dp
  JOIN documents d ON dp.document_id = d.id
  JOIN workspaces w ON d.workspace_id = w.id
  LEFT JOIN profiles inviter ON dp.granted_by = inviter.user_id
  WHERE dp.user_id = target_user_id
    AND dp.status = 'pending'
  
  ORDER BY created_at DESC;
$function$;