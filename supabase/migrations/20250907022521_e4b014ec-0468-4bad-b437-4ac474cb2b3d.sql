-- Create function to get all permissions for a specific user across all workspaces and documents that the current user owns
CREATE OR REPLACE FUNCTION public.get_user_all_permissions(target_user_id uuid)
RETURNS TABLE(
  id uuid,
  type text,
  resource_id uuid,
  resource_name text,
  workspace_name text,
  role permission_role,
  granted_by uuid,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  status text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  -- Get workspace permissions for workspaces owned by current user
  SELECT 
    wp.id,
    'workspace'::text as type,
    wp.workspace_id as resource_id,
    w.name as resource_name,
    w.name as workspace_name,
    wp.role,
    wp.granted_by,
    wp.created_at,
    wp.updated_at,
    wp.status
  FROM workspace_permissions wp
  LEFT JOIN workspaces w ON wp.workspace_id = w.id
  WHERE wp.user_id = target_user_id 
    AND w.user_id = auth.uid() -- Only workspaces owned by current user
    AND wp.role != 'owner' -- Don't include owner permissions
  
  UNION ALL
  
  -- Get document permissions for documents owned by current user
  SELECT 
    dp.id,
    'document'::text as type,
    dp.document_id as resource_id,
    d.name as resource_name,
    w.name as workspace_name,
    dp.role,
    dp.granted_by,
    dp.created_at,
    dp.updated_at,
    dp.status
  FROM document_permissions dp
  LEFT JOIN documents d ON dp.document_id = d.id
  LEFT JOIN workspaces w ON d.workspace_id = w.id
  WHERE dp.user_id = target_user_id 
    AND d.user_id = auth.uid() -- Only documents owned by current user
    AND dp.role != 'owner' -- Don't include owner permissions
  
  ORDER BY created_at DESC;
$function$