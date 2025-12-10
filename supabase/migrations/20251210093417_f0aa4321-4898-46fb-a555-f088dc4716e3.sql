-- Create a security definer function to get profile data with email protection
-- Email is only visible for the user's own profile
CREATE OR REPLACE FUNCTION public.get_profile_safely(target_user_id uuid)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  email text,
  full_name text,
  username text,
  avatar_url text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.id,
    p.user_id,
    CASE 
      WHEN p.user_id = auth.uid() THEN p.email
      ELSE NULL
    END as email,
    p.full_name,
    p.username,
    p.avatar_url,
    p.created_at,
    p.updated_at
  FROM public.profiles p
  WHERE p.user_id = target_user_id;
$$;

-- Create a function to get collaborator profiles without exposing emails
CREATE OR REPLACE FUNCTION public.get_workspace_member_profiles(ws_id uuid)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  full_name text,
  username text,
  avatar_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT
    p.id,
    p.user_id,
    p.full_name,
    p.username,
    p.avatar_url
  FROM public.profiles p
  INNER JOIN public.workspace_permissions wp ON wp.user_id = p.user_id
  WHERE wp.workspace_id = ws_id
    AND wp.status = 'accepted';
$$;

-- Update get_document_permissions to not expose email
CREATE OR REPLACE FUNCTION public.get_document_permissions(doc_id uuid)
RETURNS TABLE (
  id uuid, 
  document_id uuid, 
  user_id uuid, 
  role permission_role, 
  granted_by uuid, 
  created_at timestamp with time zone, 
  updated_at timestamp with time zone, 
  status text, 
  user_email text, 
  user_name text, 
  username text, 
  email_notifications_enabled boolean
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
    CASE 
      WHEN dp.user_id = auth.uid() THEN p.email
      ELSE NULL
    END as user_email,
    p.full_name as user_name,
    p.username,
    dp.email_notifications_enabled
  FROM document_permissions dp
  LEFT JOIN profiles p ON dp.user_id = p.user_id
  WHERE dp.document_id = doc_id
  ORDER BY dp.created_at DESC;
$$;

-- Update get_workspace_permissions to not expose email
CREATE OR REPLACE FUNCTION public.get_workspace_permissions(ws_id uuid)
RETURNS TABLE (
  id uuid, 
  workspace_id uuid, 
  user_id uuid, 
  role permission_role, 
  granted_by uuid, 
  created_at timestamp with time zone, 
  updated_at timestamp with time zone, 
  status text, 
  user_email text, 
  user_name text, 
  username text, 
  email_notifications_enabled boolean
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
    CASE 
      WHEN wp.user_id = auth.uid() THEN p.email
      ELSE NULL
    END as user_email,
    p.full_name as user_name,
    p.username,
    wp.email_notifications_enabled
  FROM workspace_permissions wp
  LEFT JOIN profiles p ON wp.user_id = p.user_id
  WHERE wp.workspace_id = ws_id
  ORDER BY wp.created_at DESC;
$$;

-- Update get_document_permissions_with_inheritance to not expose email
CREATE OR REPLACE FUNCTION public.get_document_permissions_with_inheritance(doc_id uuid)
RETURNS TABLE (
  id uuid, 
  document_id uuid, 
  user_id uuid, 
  role permission_role, 
  granted_by uuid, 
  created_at timestamp with time zone, 
  updated_at timestamp with time zone, 
  status text, 
  user_email text, 
  user_name text, 
  username text, 
  email_notifications_enabled boolean, 
  inherited_from text, 
  workspace_id uuid
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
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
    CASE 
      WHEN dp.user_id = auth.uid() THEN p.email
      ELSE NULL
    END as user_email,
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
    CASE 
      WHEN wp.user_id = auth.uid() THEN p.email
      ELSE NULL
    END as user_email,
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
$$;