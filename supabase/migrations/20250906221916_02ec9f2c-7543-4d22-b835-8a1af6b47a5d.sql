-- Add all missing foreign key relationships for complete data integrity

-- Documents table foreign keys
ALTER TABLE public.documents 
ADD CONSTRAINT fk_documents_user_id 
FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) 
ON DELETE CASCADE;

ALTER TABLE public.documents 
ADD CONSTRAINT fk_documents_workspace_id 
FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) 
ON DELETE CASCADE;

-- Workspaces table foreign keys
ALTER TABLE public.workspaces 
ADD CONSTRAINT fk_workspaces_user_id 
FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) 
ON DELETE CASCADE;

-- Document versions foreign keys
ALTER TABLE public.document_versions 
ADD CONSTRAINT fk_document_versions_user_id 
FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) 
ON DELETE CASCADE;

-- Collaboration sessions foreign keys
ALTER TABLE public.collaboration_sessions 
ADD CONSTRAINT fk_collaboration_sessions_document_id 
FOREIGN KEY (document_id) REFERENCES public.documents(id) 
ON DELETE CASCADE;

ALTER TABLE public.collaboration_sessions 
ADD CONSTRAINT fk_collaboration_sessions_user_id 
FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) 
ON DELETE CASCADE;

-- Document access logs foreign keys
ALTER TABLE public.document_access_logs 
ADD CONSTRAINT fk_document_access_logs_document_id 
FOREIGN KEY (document_id) REFERENCES public.documents(id) 
ON DELETE CASCADE;

-- YJS documents foreign keys
ALTER TABLE public.yjs_documents 
ADD CONSTRAINT fk_yjs_documents_document_id 
FOREIGN KEY (document_id) REFERENCES public.documents(id) 
ON DELETE CASCADE;

ALTER TABLE public.yjs_documents 
ADD CONSTRAINT fk_yjs_documents_user_id 
FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) 
ON DELETE CASCADE;

-- Workspace Crowdin settings foreign keys
ALTER TABLE public.workspace_crowdin_settings 
ADD CONSTRAINT fk_workspace_crowdin_settings_workspace_id 
FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) 
ON DELETE CASCADE;

ALTER TABLE public.workspace_crowdin_settings 
ADD CONSTRAINT fk_workspace_crowdin_settings_created_by 
FOREIGN KEY (created_by) REFERENCES public.profiles(user_id) 
ON DELETE CASCADE;

-- Notifications document_id foreign key (optional - can be null for workspace notifications)
ALTER TABLE public.notifications 
ADD CONSTRAINT fk_notifications_document_id 
FOREIGN KEY (document_id) REFERENCES public.documents(id) 
ON DELETE CASCADE;