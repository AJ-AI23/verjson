-- Remove the CASCADE constraint from notifications table to prevent notifications from being deleted when documents are deleted
-- This allows users to keep deletion notifications even after the document is gone

ALTER TABLE public.notifications 
DROP CONSTRAINT IF EXISTS fk_notifications_document_id;

-- Add the foreign key back but without CASCADE so notifications persist
ALTER TABLE public.notifications 
ADD CONSTRAINT fk_notifications_document_id 
FOREIGN KEY (document_id) REFERENCES public.documents(id) 
ON DELETE SET NULL;