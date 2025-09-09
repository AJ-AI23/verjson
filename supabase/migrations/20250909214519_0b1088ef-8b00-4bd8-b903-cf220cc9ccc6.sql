-- Add email_notifications_enabled column to document_permissions and workspace_permissions tables
-- This allows users to control whether they receive email notifications for each workspace/document

-- Add column to document_permissions table
ALTER TABLE public.document_permissions 
ADD COLUMN email_notifications_enabled boolean NOT NULL DEFAULT true;

-- Add column to workspace_permissions table  
ALTER TABLE public.workspace_permissions 
ADD COLUMN email_notifications_enabled boolean NOT NULL DEFAULT true;

-- Drop existing functions and recreate with new return type
DROP FUNCTION IF EXISTS public.get_document_permissions(uuid);
DROP FUNCTION IF EXISTS public.get_workspace_permissions(uuid);

-- Recreate the database functions to include the new column
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
    p.email as user_email,
    p.full_name as user_name,
    p.username,
    dp.email_notifications_enabled
  FROM document_permissions dp
  LEFT JOIN profiles p ON dp.user_id = p.user_id
  WHERE dp.document_id = doc_id
  ORDER BY dp.created_at DESC;
$function$;

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
    p.email as user_email,
    p.full_name as user_name,
    p.username,
    wp.email_notifications_enabled
  FROM workspace_permissions wp
  LEFT JOIN profiles p ON wp.user_id = p.user_id
  WHERE wp.workspace_id = ws_id
  ORDER BY wp.created_at DESC;
$function$;