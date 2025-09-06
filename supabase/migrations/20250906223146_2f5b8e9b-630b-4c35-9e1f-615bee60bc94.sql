-- Add missing foreign key relationships to ensure data integrity and enable proper JOINs

-- Core relationships to profiles table
ALTER TABLE public.document_permissions 
ADD CONSTRAINT fk_document_permissions_user_id 
FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE public.document_permissions 
ADD CONSTRAINT fk_document_permissions_granted_by 
FOREIGN KEY (granted_by) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE public.workspace_permissions 
ADD CONSTRAINT fk_workspace_permissions_user_id 
FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE public.workspace_permissions 
ADD CONSTRAINT fk_workspace_permissions_granted_by 
FOREIGN KEY (granted_by) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

-- Document and workspace relationships
ALTER TABLE public.document_permissions 
ADD CONSTRAINT fk_document_permissions_document_id 
FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;

ALTER TABLE public.workspace_permissions 
ADD CONSTRAINT fk_workspace_permissions_workspace_id 
FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- Other core relationships
ALTER TABLE public.documents 
ADD CONSTRAINT fk_documents_user_id 
FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE public.documents 
ADD CONSTRAINT fk_documents_workspace_id 
FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE public.workspaces 
ADD CONSTRAINT fk_workspaces_user_id 
FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

-- Version and collaboration relationships
ALTER TABLE public.document_versions 
ADD CONSTRAINT fk_document_versions_document_id 
FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;

ALTER TABLE public.document_versions 
ADD CONSTRAINT fk_document_versions_user_id 
FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE public.collaboration_sessions 
ADD CONSTRAINT fk_collaboration_sessions_document_id 
FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;

ALTER TABLE public.collaboration_sessions 
ADD CONSTRAINT fk_collaboration_sessions_user_id 
FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

-- Logging and access relationships
ALTER TABLE public.document_access_logs 
ADD CONSTRAINT fk_document_access_logs_document_id 
FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;

ALTER TABLE public.yjs_documents 
ADD CONSTRAINT fk_yjs_documents_document_id 
FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;

ALTER TABLE public.yjs_documents 
ADD CONSTRAINT fk_yjs_documents_user_id 
FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

-- Notifications and settings relationships
ALTER TABLE public.notifications 
ADD CONSTRAINT fk_notifications_user_id 
FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE public.notifications 
ADD CONSTRAINT fk_notifications_document_id 
FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;

ALTER TABLE public.workspace_crowdin_settings 
ADD CONSTRAINT fk_workspace_crowdin_settings_workspace_id 
FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE public.workspace_crowdin_settings 
ADD CONSTRAINT fk_workspace_crowdin_settings_created_by 
FOREIGN KEY (created_by) REFERENCES public.profiles(user_id) ON DELETE CASCADE;