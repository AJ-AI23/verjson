-- Create a database function to get shared documents for a user
CREATE OR REPLACE FUNCTION public.get_shared_documents(target_user_id uuid)
 RETURNS TABLE(
   id uuid,
   name text,
   workspace_id uuid,
   user_id uuid,
   file_type text,
   created_at timestamp with time zone,
   updated_at timestamp with time zone,
   crowdin_integration_id uuid,
   workspace_name text,
   shared_role permission_role,
   is_shared boolean,
   crowdin_integration jsonb
 )
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    d.id,
    d.name,
    d.workspace_id,
    d.user_id,
    d.file_type,
    d.created_at,
    d.updated_at,
    d.crowdin_integration_id,
    w.name as workspace_name,
    dp.role as shared_role,
    true as is_shared,
    CASE 
      WHEN d.crowdin_integration_id IS NOT NULL THEN
        jsonb_build_object(
          'id', ci.id,
          'file_id', ci.file_id,
          'file_ids', ci.file_ids,
          'filename', ci.filename,
          'filenames', ci.filenames,
          'project_id', ci.project_id,
          'split_by_paths', ci.split_by_paths
        )
      ELSE NULL
    END as crowdin_integration
  FROM documents d
  JOIN document_permissions dp ON d.id = dp.document_id
  JOIN workspaces w ON d.workspace_id = w.id
  LEFT JOIN document_crowdin_integrations ci ON d.crowdin_integration_id = ci.id
  WHERE dp.user_id = target_user_id
    AND dp.status = 'accepted'
    AND NOT EXISTS (
      SELECT 1 FROM workspace_permissions wp
      WHERE wp.workspace_id = d.workspace_id
        AND wp.user_id = target_user_id
        AND wp.status = 'accepted'
    )
  ORDER BY d.created_at DESC;
$function$