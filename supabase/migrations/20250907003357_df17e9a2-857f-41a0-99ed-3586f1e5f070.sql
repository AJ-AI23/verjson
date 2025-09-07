-- Update database functions to work with refactored notifications table

-- Drop the old invitation-related functions since invitations are now handled by workspace_permissions
DROP FUNCTION IF EXISTS public.create_invitation_notification(uuid, uuid, text, jsonb, text, text);
DROP FUNCTION IF EXISTS public.accept_invitation(uuid);
DROP FUNCTION IF EXISTS public.decline_invitation(uuid);

-- Update the notation notification functions to work with the new schema
CREATE OR REPLACE FUNCTION public.create_notation_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public 
AS $$
DECLARE
  doc_record RECORD;
  notification_title TEXT;
  notification_message TEXT;
BEGIN
  -- Get document information
  SELECT name, workspace_id, user_id as doc_owner_id INTO doc_record
  FROM documents 
  WHERE id = NEW.document_id;
  
  -- Create notification title and message
  notification_title := 'New notation in "' || doc_record.name || '"';
  notification_message := 'A new notation was added to document "' || doc_record.name || '"';
  
  -- Create notifications for all users with access to this document
  -- 1. Document owner (if not the one who made the notation)
  IF doc_record.doc_owner_id != NEW.user_id THEN
    INSERT INTO public.notifications (user_id, document_id, workspace_id, type, title, message)
    VALUES (doc_record.doc_owner_id, NEW.document_id, doc_record.workspace_id, 'notation', notification_title, notification_message)
    ON CONFLICT DO NOTHING;
  END IF;
  
  -- 2. Users with workspace access (excluding document owner and notation author)
  INSERT INTO public.notifications (user_id, document_id, workspace_id, type, title, message)
  SELECT wp.user_id, NEW.document_id, doc_record.workspace_id, 'notation', notification_title, notification_message
  FROM workspace_permissions wp
  WHERE wp.workspace_id = doc_record.workspace_id
    AND wp.user_id != NEW.user_id -- Don't notify the user who made the notation
    AND wp.user_id != doc_record.doc_owner_id -- Document owner already handled above
    AND wp.status = 'accepted' -- Only notify accepted members
    AND NOT EXISTS (
      SELECT 1 FROM public.notifications n 
      WHERE n.user_id = wp.user_id 
        AND n.document_id = NEW.document_id 
        AND n.created_at > (now() - interval '5 minutes') -- Avoid spam
    )
  ON CONFLICT DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Update detect_document_notation_changes function
CREATE OR REPLACE FUNCTION public.detect_document_notation_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public 
AS $$
DECLARE
  doc_record RECORD;
  notification_title TEXT;
  notification_message TEXT;
  old_notations jsonb;
  new_notations jsonb;
BEGIN
  -- Get document information
  SELECT name, workspace_id, user_id as doc_owner_id 
  INTO doc_record
  FROM documents 
  WHERE id = NEW.id;
  
  -- Extract notations from the document content (both old and new)
  old_notations := COALESCE(OLD.content->'$notations', '[]'::jsonb);
  new_notations := COALESCE(NEW.content->'$notations', '[]'::jsonb);
  
  -- Only proceed if we have more notations now than before
  IF jsonb_array_length(new_notations) > jsonb_array_length(old_notations) THEN
    -- Create notification title and message
    notification_title := 'New notation in "' || doc_record.name || '"';
    notification_message := 'A new notation was added to document "' || doc_record.name || '"';
    
    -- Create notifications for all users with access to this document
    -- 1. Document owner (if not the one who made the notation - we'll use the current user)
    IF doc_record.doc_owner_id != auth.uid() THEN
      INSERT INTO public.notifications (user_id, document_id, workspace_id, type, title, message)
      VALUES (doc_record.doc_owner_id, NEW.id, doc_record.workspace_id, 'notation', notification_title, notification_message)
      ON CONFLICT DO NOTHING;
    END IF;
    
    -- 2. Users with workspace access (excluding document owner and notation author)
    INSERT INTO public.notifications (user_id, document_id, workspace_id, type, title, message)
    SELECT wp.user_id, NEW.id, doc_record.workspace_id, 'notation', notification_title, notification_message
    FROM workspace_permissions wp
    WHERE wp.workspace_id = doc_record.workspace_id
      AND wp.user_id != auth.uid() -- Don't notify the current user who made the notation
      AND wp.user_id != doc_record.doc_owner_id -- Document owner already handled above
      AND wp.status = 'accepted' -- Only notify accepted members
      AND NOT EXISTS (
        SELECT 1 FROM public.notifications n 
        WHERE n.user_id = wp.user_id 
          AND n.document_id = NEW.id 
          AND n.created_at > (now() - interval '5 minutes') -- Avoid spam
      )
    ON CONFLICT DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create a simple function to create workspace-level notifications
CREATE OR REPLACE FUNCTION public.create_workspace_notification(
  target_workspace_id uuid,
  notification_type text,
  notification_title text,
  notification_message text,
  exclude_user_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public 
AS $$
BEGIN
  -- Create notifications for all users with access to the workspace
  INSERT INTO public.notifications (user_id, workspace_id, type, title, message)
  SELECT wp.user_id, target_workspace_id, notification_type, notification_title, notification_message
  FROM workspace_permissions wp
  WHERE wp.workspace_id = target_workspace_id
    AND wp.status = 'accepted'
    AND (exclude_user_id IS NULL OR wp.user_id != exclude_user_id);
    
  -- Also notify the workspace owner
  INSERT INTO public.notifications (user_id, workspace_id, type, title, message)
  SELECT w.user_id, target_workspace_id, notification_type, notification_title, notification_message
  FROM workspaces w
  WHERE w.id = target_workspace_id
    AND (exclude_user_id IS NULL OR w.user_id != exclude_user_id)
  ON CONFLICT DO NOTHING;
END;
$$;