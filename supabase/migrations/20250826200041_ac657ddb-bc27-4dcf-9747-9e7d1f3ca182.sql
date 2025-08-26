-- Create notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  document_id UUID NOT NULL,
  type TEXT NOT NULL DEFAULT 'notation',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Create policies for notifications
CREATE POLICY "Users can view their own notifications" 
ON public.notifications 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" 
ON public.notifications 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_notifications_updated_at
BEFORE UPDATE ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to create notifications when notations are added
CREATE OR REPLACE FUNCTION public.create_notation_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  doc_record RECORD;
  notification_title TEXT;
  notification_message TEXT;
  target_user_id UUID;
BEGIN
  -- Get document information
  SELECT name, workspace_id INTO doc_record
  FROM documents 
  WHERE id = NEW.document_id;
  
  -- Create notification title and message
  notification_title := 'New notation in "' || doc_record.name || '"';
  notification_message := 'A new notation was added to document "' || doc_record.name || '"';
  
  -- Create notifications for all users with access to this document
  -- 1. Document owner
  INSERT INTO public.notifications (user_id, document_id, type, title, message)
  SELECT d.user_id, NEW.document_id, 'notation', notification_title, notification_message
  FROM documents d
  WHERE d.id = NEW.document_id 
    AND d.user_id != NEW.user_id -- Don't notify the user who made the notation
    AND NOT EXISTS (
      SELECT 1 FROM public.notifications n 
      WHERE n.user_id = d.user_id 
        AND n.document_id = NEW.document_id 
        AND n.created_at > (now() - interval '5 minutes') -- Avoid spam
    );
  
  -- 2. Users with workspace access
  INSERT INTO public.notifications (user_id, document_id, type, title, message)
  SELECT wp.user_id, NEW.document_id, 'notation', notification_title, notification_message
  FROM workspace_permissions wp
  JOIN documents d ON d.workspace_id = wp.workspace_id
  WHERE d.id = NEW.document_id 
    AND wp.user_id != NEW.user_id -- Don't notify the user who made the notation
    AND wp.user_id != d.user_id -- Already handled above
    AND NOT EXISTS (
      SELECT 1 FROM public.notifications n 
      WHERE n.user_id = wp.user_id 
        AND n.document_id = NEW.document_id 
        AND n.created_at > (now() - interval '5 minutes') -- Avoid spam
    );
  
  RETURN NEW;
END;
$function$;

-- Add index for better performance
CREATE INDEX idx_notifications_user_id_read_at ON public.notifications(user_id, read_at);
CREATE INDEX idx_notifications_document_id ON public.notifications(document_id);

-- Enable realtime for notifications
ALTER TABLE public.notifications REPLICA IDENTITY FULL;