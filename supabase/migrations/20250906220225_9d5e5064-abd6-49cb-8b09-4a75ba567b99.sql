-- Make document_id nullable in notifications table since workspace invitations don't have a document_id
ALTER TABLE public.notifications ALTER COLUMN document_id DROP NOT NULL;