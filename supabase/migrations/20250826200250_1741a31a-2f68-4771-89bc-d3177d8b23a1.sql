-- Create trigger on document_versions table since that's where notation changes are tracked
CREATE OR REPLACE FUNCTION public.detect_notation_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  doc_record RECORD;
  notification_title TEXT;
  notification_message TEXT;
  old_notations jsonb;
  new_notations jsonb;
  notation_item jsonb;
BEGIN
  -- Get document information
  SELECT name, workspace_id, user_id as doc_owner_id 
  INTO doc_record
  FROM documents 
  WHERE id = NEW.document_id;
  
  -- Extract notations from the full document (both old and new)
  old_notations := COALESCE(OLD.full_document->'$notations', '[]'::jsonb);
  new_notations := COALESCE(NEW.full_document->'$notations', '[]'::jsonb);
  
  -- Only proceed if we have more notations now than before
  IF jsonb_array_length(new_notations) > jsonb_array_length(old_notations) THEN
    -- Create notification title and message
    notification_title := 'New notation in "' || doc_record.name || '"';
    notification_message := 'A new notation was added to document "' || doc_record.name || '"';
    
    -- Create notifications for all users with access to this document
    -- 1. Document owner (if not the one who made the notation)
    IF doc_record.doc_owner_id != NEW.user_id THEN
      INSERT INTO public.notifications (user_id, document_id, type, title, message)
      VALUES (doc_record.doc_owner_id, NEW.document_id, 'notation', notification_title, notification_message)
      ON CONFLICT DO NOTHING;
    END IF;
    
    -- 2. Users with workspace access (excluding document owner and notation author)
    INSERT INTO public.notifications (user_id, document_id, type, title, message)
    SELECT wp.user_id, NEW.document_id, 'notation', notification_title, notification_message
    FROM workspace_permissions wp
    JOIN documents d ON d.workspace_id = wp.workspace_id
    WHERE d.id = NEW.document_id 
      AND wp.user_id != NEW.user_id -- Don't notify the user who made the notation
      AND wp.user_id != doc_record.doc_owner_id -- Document owner already handled above
      AND NOT EXISTS (
        SELECT 1 FROM public.notifications n 
        WHERE n.user_id = wp.user_id 
          AND n.document_id = NEW.document_id 
          AND n.created_at > (now() - interval '5 minutes') -- Avoid spam
      )
    ON CONFLICT DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger on document_versions table
CREATE OR REPLACE TRIGGER trigger_detect_notation_changes
AFTER INSERT OR UPDATE ON public.document_versions
FOR EACH ROW
EXECUTE FUNCTION public.detect_notation_changes();

-- Also create a simpler trigger for direct document updates (when notations are added without versioning)
CREATE OR REPLACE FUNCTION public.detect_document_notation_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
      INSERT INTO public.notifications (user_id, document_id, type, title, message)
      VALUES (doc_record.doc_owner_id, NEW.id, 'notation', notification_title, notification_message)
      ON CONFLICT DO NOTHING;
    END IF;
    
    -- 2. Users with workspace access (excluding document owner and notation author)
    INSERT INTO public.notifications (user_id, document_id, type, title, message)
    SELECT wp.user_id, NEW.id, 'notation', notification_title, notification_message
    FROM workspace_permissions wp
    JOIN documents d ON d.workspace_id = wp.workspace_id
    WHERE d.id = NEW.id 
      AND wp.user_id != auth.uid() -- Don't notify the current user who made the notation
      AND wp.user_id != doc_record.doc_owner_id -- Document owner already handled above
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
$function$;

-- Create trigger on documents table for direct document updates
CREATE OR REPLACE TRIGGER trigger_detect_document_notation_changes
AFTER UPDATE ON public.documents
FOR EACH ROW
EXECUTE FUNCTION public.detect_document_notation_changes();