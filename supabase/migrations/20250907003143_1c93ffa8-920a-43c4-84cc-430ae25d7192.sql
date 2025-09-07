-- Add foreign key constraint for workspace_id in notifications table
ALTER TABLE public.notifications 
ADD CONSTRAINT fk_notifications_workspace_id 
FOREIGN KEY (workspace_id) 
REFERENCES public.workspaces(id) 
ON DELETE CASCADE;