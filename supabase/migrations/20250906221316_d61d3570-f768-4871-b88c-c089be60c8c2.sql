-- Add foreign key constraints to ensure proper relationships
-- This will allow us to use JOIN queries efficiently

-- Add foreign key from workspace_permissions to profiles
ALTER TABLE public.workspace_permissions 
ADD CONSTRAINT fk_workspace_permissions_user_id 
FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) 
ON DELETE CASCADE;

-- Add foreign key from document_permissions to profiles  
ALTER TABLE public.document_permissions 
ADD CONSTRAINT fk_document_permissions_user_id 
FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) 
ON DELETE CASCADE;

-- Add foreign key from notifications to profiles
ALTER TABLE public.notifications 
ADD CONSTRAINT fk_notifications_user_id 
FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) 
ON DELETE CASCADE;

-- Add foreign key from workspace_permissions to workspaces
ALTER TABLE public.workspace_permissions 
ADD CONSTRAINT fk_workspace_permissions_workspace_id 
FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) 
ON DELETE CASCADE;

-- Add foreign key from document_permissions to documents
ALTER TABLE public.document_permissions 
ADD CONSTRAINT fk_document_permissions_document_id 
FOREIGN KEY (document_id) REFERENCES public.documents(id) 
ON DELETE CASCADE;