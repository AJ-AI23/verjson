-- Create triggers to automatically assign owner permissions when creating workspaces/documents

-- Function to create workspace owner permission
CREATE OR REPLACE FUNCTION public.create_workspace_owner_permission()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.workspace_permissions (workspace_id, user_id, role, granted_by)
  VALUES (NEW.id, NEW.user_id, 'owner', NEW.user_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create document owner permission
CREATE OR REPLACE FUNCTION public.create_document_owner_permission()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.document_permissions (document_id, user_id, role, granted_by)
  VALUES (NEW.id, NEW.user_id, 'owner', NEW.user_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers
CREATE TRIGGER create_workspace_owner_permission_trigger
  AFTER INSERT ON public.workspaces
  FOR EACH ROW
  EXECUTE FUNCTION public.create_workspace_owner_permission();

CREATE TRIGGER create_document_owner_permission_trigger
  AFTER INSERT ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION public.create_document_owner_permission();

-- Create a view to easily get user permissions across both workspaces and documents
CREATE OR REPLACE VIEW public.user_permissions_summary AS
SELECT 
  'workspace' as permission_type,
  wp.id,
  wp.workspace_id as resource_id,
  w.name as resource_name,
  wp.user_id,
  wp.role,
  wp.granted_by,
  wp.created_at,
  wp.updated_at,
  p.email as user_email,
  p.full_name as user_name
FROM public.workspace_permissions wp
JOIN public.workspaces w ON wp.workspace_id = w.id
LEFT JOIN public.profiles p ON wp.user_id = p.user_id

UNION ALL

SELECT 
  'document' as permission_type,
  dp.id,
  dp.document_id as resource_id,
  d.name as resource_name,
  dp.user_id,
  dp.role,
  dp.granted_by,
  dp.created_at,
  dp.updated_at,
  p.email as user_email,
  p.full_name as user_name
FROM public.document_permissions dp
JOIN public.documents d ON dp.document_id = d.id
LEFT JOIN public.profiles p ON dp.user_id = p.user_id;