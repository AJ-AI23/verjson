-- Create functions to fetch permissions with user details using proper JOINs

CREATE OR REPLACE FUNCTION public.get_document_permissions(doc_id uuid)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  user_id uuid,
  role permission_role,
  granted_by uuid,
  created_at timestamptz,
  updated_at timestamptz,
  status text,
  user_email text,
  user_name text,
  username text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    dp.id,
    dp.document_id,
    dp.user_id,
    dp.role,
    dp.granted_by,
    dp.created_at,
    dp.updated_at,
    dp.status,
    p.email as user_email,
    p.full_name as user_name,
    p.username
  FROM document_permissions dp
  LEFT JOIN profiles p ON dp.user_id = p.user_id
  WHERE dp.document_id = doc_id
  ORDER BY dp.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.get_workspace_permissions(ws_id uuid)
RETURNS TABLE (
  id uuid,
  workspace_id uuid,
  user_id uuid,
  role permission_role,
  granted_by uuid,
  created_at timestamptz,
  updated_at timestamptz,
  status text,
  user_email text,
  user_name text,
  username text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    wp.id,
    wp.workspace_id,
    wp.user_id,
    wp.role,
    wp.granted_by,
    wp.created_at,
    wp.updated_at,
    wp.status,
    p.email as user_email,
    p.full_name as user_name,
    p.username
  FROM workspace_permissions wp
  LEFT JOIN profiles p ON wp.user_id = p.user_id
  WHERE wp.workspace_id = ws_id
  ORDER BY wp.created_at DESC;
$$;