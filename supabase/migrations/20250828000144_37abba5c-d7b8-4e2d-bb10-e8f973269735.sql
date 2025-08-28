-- Add invitation status to permissions tables and create invitation notifications

-- Add status field to document_permissions to track pending invitations
ALTER TABLE public.document_permissions 
ADD COLUMN status text DEFAULT 'accepted' CHECK (status IN ('pending', 'accepted', 'declined'));

-- Add status field to workspace_permissions to track pending invitations  
ALTER TABLE public.workspace_permissions
ADD COLUMN status text DEFAULT 'accepted' CHECK (status IN ('pending', 'accepted', 'declined'));

-- Add invitation_type and invitation_data to notifications for invitations
ALTER TABLE public.notifications
ADD COLUMN invitation_type text CHECK (invitation_type IN ('document', 'workspace', 'bulk_documents')),
ADD COLUMN invitation_data jsonb,
ADD COLUMN status text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined'));

-- Create function to create invitation notifications
CREATE OR REPLACE FUNCTION public.create_invitation_notification(
  target_user_id uuid,
  inviter_user_id uuid,
  inv_type text,
  inv_data jsonb,
  title text,
  message text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  notification_id uuid;
BEGIN
  INSERT INTO public.notifications (
    user_id, 
    type, 
    title, 
    message,
    invitation_type,
    invitation_data,
    status
  ) VALUES (
    target_user_id,
    'invitation',
    title,
    message,
    inv_type,
    inv_data,
    'pending'
  ) RETURNING id INTO notification_id;
  
  RETURN notification_id;
END;
$$;

-- Create function to handle invitation acceptance
CREATE OR REPLACE FUNCTION public.accept_invitation(notification_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  notification_record record;
  permission_id uuid;
BEGIN
  -- Get the notification details
  SELECT * INTO notification_record
  FROM public.notifications 
  WHERE id = notification_id AND user_id = auth.uid() AND status = 'pending';
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Update notification status
  UPDATE public.notifications 
  SET status = 'accepted', updated_at = now()
  WHERE id = notification_id;
  
  -- Update permission status based on invitation type
  IF notification_record.invitation_type = 'document' THEN
    UPDATE public.document_permissions 
    SET status = 'accepted'
    WHERE user_id = auth.uid() 
      AND document_id = (notification_record.invitation_data->>'document_id')::uuid
      AND status = 'pending';
      
  ELSIF notification_record.invitation_type = 'workspace' THEN
    UPDATE public.workspace_permissions 
    SET status = 'accepted'
    WHERE user_id = auth.uid() 
      AND workspace_id = (notification_record.invitation_data->>'workspace_id')::uuid
      AND status = 'pending';
      
  ELSIF notification_record.invitation_type = 'bulk_documents' THEN
    -- Update all document permissions for the bulk invitation
    UPDATE public.document_permissions 
    SET status = 'accepted'
    WHERE user_id = auth.uid() 
      AND document_id = ANY(
        SELECT (jsonb_array_elements_text(notification_record.invitation_data->'document_ids'))::uuid
      )
      AND status = 'pending';
  END IF;
  
  RETURN true;
END;
$$;

-- Create function to handle invitation decline
CREATE OR REPLACE FUNCTION public.decline_invitation(notification_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  notification_record record;
  inviter_notification_title text;
  inviter_notification_message text;
  user_profile record;
BEGIN
  -- Get the notification details
  SELECT * INTO notification_record
  FROM public.notifications 
  WHERE id = notification_id AND user_id = auth.uid() AND status = 'pending';
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Get user profile for notification
  SELECT email, full_name INTO user_profile
  FROM public.profiles
  WHERE user_id = auth.uid();
  
  -- Update notification status
  UPDATE public.notifications 
  SET status = 'declined', updated_at = now()
  WHERE id = notification_id;
  
  -- Remove permissions based on invitation type
  IF notification_record.invitation_type = 'document' THEN
    DELETE FROM public.document_permissions 
    WHERE user_id = auth.uid() 
      AND document_id = (notification_record.invitation_data->>'document_id')::uuid
      AND status = 'pending';
      
    -- Create notification for inviter
    inviter_notification_title := COALESCE(user_profile.full_name, user_profile.email) || ' declined document invitation';
    inviter_notification_message := 'Your invitation to collaborate on "' || 
      (notification_record.invitation_data->>'document_name') || '" was declined.';
      
  ELSIF notification_record.invitation_type = 'workspace' THEN
    DELETE FROM public.workspace_permissions 
    WHERE user_id = auth.uid() 
      AND workspace_id = (notification_record.invitation_data->>'workspace_id')::uuid
      AND status = 'pending';
      
    -- Create notification for inviter
    inviter_notification_title := COALESCE(user_profile.full_name, user_profile.email) || ' declined workspace invitation';
    inviter_notification_message := 'Your invitation to collaborate on workspace "' || 
      (notification_record.invitation_data->>'workspace_name') || '" was declined.';
      
  ELSIF notification_record.invitation_type = 'bulk_documents' THEN
    -- Remove all document permissions for the bulk invitation
    DELETE FROM public.document_permissions 
    WHERE user_id = auth.uid() 
      AND document_id = ANY(
        SELECT (jsonb_array_elements_text(notification_record.invitation_data->'document_ids'))::uuid
      )
      AND status = 'pending';
      
    -- Create notification for inviter
    inviter_notification_title := COALESCE(user_profile.full_name, user_profile.email) || ' declined bulk document invitation';
    inviter_notification_message := 'Your invitation to collaborate on ' || 
      (notification_record.invitation_data->>'document_count') || ' documents was declined.';
  END IF;
  
  -- Send notification to inviter
  INSERT INTO public.notifications (
    user_id,
    type,
    title,
    message
  ) VALUES (
    (notification_record.invitation_data->>'inviter_id')::uuid,
    'invitation_declined',
    inviter_notification_title,
    inviter_notification_message
  );
  
  RETURN true;
END;
$$;