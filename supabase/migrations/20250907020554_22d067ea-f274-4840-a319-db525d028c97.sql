-- Function to get all pending invitations for a user
CREATE OR REPLACE FUNCTION public.get_user_invitations(target_user_id uuid)
RETURNS TABLE(
  id uuid,
  type text,
  workspace_id uuid,
  document_id uuid,
  workspace_name text,
  document_name text,
  role permission_role,
  inviter_email text,
  inviter_name text,
  created_at timestamp with time zone
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  -- Get workspace invitations
  SELECT 
    wp.id,
    'workspace'::text as type,
    wp.workspace_id,
    NULL::uuid as document_id,
    w.name as workspace_name,
    NULL::text as document_name,
    wp.role,
    inviter.email as inviter_email,
    COALESCE(inviter.full_name, inviter.email) as inviter_name,
    wp.created_at
  FROM workspace_permissions wp
  LEFT JOIN workspaces w ON wp.workspace_id = w.id
  LEFT JOIN profiles inviter ON wp.granted_by = inviter.user_id
  WHERE wp.user_id = target_user_id 
    AND wp.status = 'pending'
  
  UNION ALL
  
  -- Get document invitations
  SELECT 
    dp.id,
    'document'::text as type,
    d.workspace_id,
    dp.document_id,
    NULL::text as workspace_name,
    d.name as document_name,
    dp.role,
    inviter.email as inviter_email,
    COALESCE(inviter.full_name, inviter.email) as inviter_name,
    dp.created_at
  FROM document_permissions dp
  LEFT JOIN documents d ON dp.document_id = d.id
  LEFT JOIN profiles inviter ON dp.granted_by = inviter.user_id
  WHERE dp.user_id = target_user_id 
    AND dp.status = 'pending'
  
  ORDER BY created_at DESC;
$function$;

-- Function to accept an invitation
CREATE OR REPLACE FUNCTION public.accept_invitation(invitation_id uuid, invitation_type text)
RETURNS TABLE(
  success boolean,
  message text,
  workspace_id uuid,
  document_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  target_workspace_id uuid;
  target_document_id uuid;
  permission_exists boolean;
BEGIN
  -- Validate invitation type
  IF invitation_type NOT IN ('workspace', 'document') THEN
    RETURN QUERY SELECT false, 'Invalid invitation type'::text, NULL::uuid, NULL::uuid;
    RETURN;
  END IF;

  -- Handle workspace invitation
  IF invitation_type = 'workspace' THEN
    -- Check if permission exists and belongs to the current user
    SELECT EXISTS(
      SELECT 1 FROM workspace_permissions 
      WHERE id = invitation_id 
        AND user_id = auth.uid() 
        AND status = 'pending'
    ), workspace_permissions.workspace_id
    INTO permission_exists, target_workspace_id
    FROM workspace_permissions 
    WHERE id = invitation_id 
      AND user_id = auth.uid() 
      AND status = 'pending';
    
    IF NOT permission_exists THEN
      RETURN QUERY SELECT false, 'Invitation not found or already processed'::text, NULL::uuid, NULL::uuid;
      RETURN;
    END IF;
    
    -- Accept the invitation
    UPDATE workspace_permissions 
    SET status = 'accepted', updated_at = now()
    WHERE id = invitation_id AND user_id = auth.uid();
    
    RETURN QUERY SELECT true, 'Workspace invitation accepted successfully'::text, target_workspace_id, NULL::uuid;
    
  -- Handle document invitation
  ELSIF invitation_type = 'document' THEN
    -- Check if permission exists and belongs to the current user
    SELECT EXISTS(
      SELECT 1 FROM document_permissions 
      WHERE id = invitation_id 
        AND user_id = auth.uid() 
        AND status = 'pending'
    ), document_permissions.document_id
    INTO permission_exists, target_document_id
    FROM document_permissions 
    WHERE id = invitation_id 
      AND user_id = auth.uid() 
      AND status = 'pending';
    
    IF NOT permission_exists THEN
      RETURN QUERY SELECT false, 'Invitation not found or already processed'::text, NULL::uuid, NULL::uuid;
      RETURN;
    END IF;
    
    -- Accept the invitation
    UPDATE document_permissions 
    SET status = 'accepted', updated_at = now()
    WHERE id = invitation_id AND user_id = auth.uid();
    
    RETURN QUERY SELECT true, 'Document invitation accepted successfully'::text, NULL::uuid, target_document_id;
  END IF;
END;
$function$;

-- Function to decline an invitation
CREATE OR REPLACE FUNCTION public.decline_invitation(invitation_id uuid, invitation_type text)
RETURNS TABLE(
  success boolean,
  message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  permission_exists boolean;
BEGIN
  -- Validate invitation type
  IF invitation_type NOT IN ('workspace', 'document') THEN
    RETURN QUERY SELECT false, 'Invalid invitation type'::text;
    RETURN;
  END IF;

  -- Handle workspace invitation
  IF invitation_type = 'workspace' THEN
    -- Check if permission exists and belongs to the current user
    SELECT EXISTS(
      SELECT 1 FROM workspace_permissions 
      WHERE id = invitation_id 
        AND user_id = auth.uid() 
        AND status = 'pending'
    ) INTO permission_exists;
    
    IF NOT permission_exists THEN
      RETURN QUERY SELECT false, 'Invitation not found or already processed'::text;
      RETURN;
    END IF;
    
    -- Delete the invitation
    DELETE FROM workspace_permissions 
    WHERE id = invitation_id AND user_id = auth.uid() AND status = 'pending';
    
    RETURN QUERY SELECT true, 'Workspace invitation declined successfully'::text;
    
  -- Handle document invitation
  ELSIF invitation_type = 'document' THEN
    -- Check if permission exists and belongs to the current user
    SELECT EXISTS(
      SELECT 1 FROM document_permissions 
      WHERE id = invitation_id 
        AND user_id = auth.uid() 
        AND status = 'pending'
    ) INTO permission_exists;
    
    IF NOT permission_exists THEN
      RETURN QUERY SELECT false, 'Invitation not found or already processed'::text;
      RETURN;
    END IF;
    
    -- Delete the invitation
    DELETE FROM document_permissions 
    WHERE id = invitation_id AND user_id = auth.uid() AND status = 'pending';
    
    RETURN QUERY SELECT true, 'Document invitation declined successfully'::text;
  END IF;
END;
$function$;